var bitcoin = require('bitcoinjs-lib')
var async = require('async')
var Chain = require('chain-node')
var chain = new Chain({
  keyId: '76d17cc172437fe06cf60344fef0ea3d',
  keySecret: '95dab410c0a6f886afb174e03bfb34af',
  blockChain: 'bitcoin'
})

var network = bitcoin.networks.bitcoin
var fee = 1000
var tick_amount = 600
var local_private = 'cRgPbmR3DAi6LjfUFfFJBvfHtJuQMaoyCMF3eiiwM8GxkFkcDncB'
local_private = bitcoin.ECKey.fromWIF(local_private)

var get_multisig_address = function(req, res, next) {
  var params = req.data
  var public_key = params.public_key
  
  var address = get_multisig_from_public(public_key, function(err, address){
    if (err) return next(err)
    return res.send(address)
  })
}

var get_multisig_from_public = function(public_key, callback) {
  public_key = bitcoin.ECPubKey.fromHex(public_key)
  var local_public_key = local_private.pub
  var pubKeys = [public_key, local_public_key]
  
  var redeemScript = bitcoin.scripts.multisigOutput(2, pubKeys) // 2 of 2
  var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash())
  var address = bitcoin.Address.fromOutputScript(scriptPubKey, network).toString()
  
  var data = {
    multisig_address : address,
    public_keys : pubKeys.map(function (x) {
      return x.toHex()
    }),
    redeem_script : redeemScript.toHex(),
  }
  db.insert('Sessions', data, null, function(err, res2) {
    if (err) return callback(err)
    callback(null, address)
  })
}

var get_account_balance = function(req, res, next) {
  var params = req.data
  var multisig_address = params.multisig_address
  
  var value = 0
  var num_of_signs = 0
  var first_txid
  var used
  
  async.waterfall([
    function(callback) {
      chain.getAddressUnspents(multisig_address, callback)
    },
    function(utxos, callback) {
      utxos.forEach(function(utxo) {
        value+=utxo.value
        num_of_signs++
      })
      if (value) {
        first_txid = utxos[0].transaction_hash
      }
      get_session(multisig_address, callback)
    },
    function(session, callback) {
      used = session.last_amount || 0
      if (first_txid) {
        return update_session(session, first_txid, callback)
      }
      callback()
    },
  ],
  function(err) {
    if(err) return next(err)
    var ans = {
      balance : value,
      used : used,
    }
    return res.send(ans)
  })
}

var get_session = function (multisig_address, callback){
  var sessions = db.get_model('Sessions')
  var conditions = {
    multisig_address : multisig_address
  }
  sessions.findOne(conditions).exec(callback)
}

var update_session = function(session, first_txid, callback) {
  var change = 0
  async.parallel([
    function(cb) {
      if (!session.return_address) {
        chain.getTransaction(first_txid, function(err, resp) {
          session.return_address = resp.inputs[0].addresses[0]
          change = 1
          cb()
        })
      }
      else {
        cb()
      }
    },
  ],
  function(err) {
    if (change) {
      session.save(callback)
    }
    else {
      callback()
    }
  })
}

var tick = function(req, res, next) {
  var params = req.data
  var multisig_address = params.multisig_address
  
  create_temp_tx(multisig_address, function(err, ans) {
    if (err) return next(err)
    res.send(ans)
  })
}

var create_temp_tx = function(multisig_address, callback) {
  var unspents
  async.waterfall([
    function(cb) {
      chain.getAddressUnspents(multisig_address, cb)
    },
    function(l_unspents, cb) {
      unspents = l_unspents
      
      get_session(multisig_address, cb)
    },
    function(session, cb) {
      var public_keys = session.public_keys
      public_keys = public_keys.map(bitcoin.ECPubKey.fromHex)
      var return_address = session.return_address
      var last_amount = session.last_amount || 0
      var txb = new bitcoin.TransactionBuilder()
      var value = 0
      var num_of_signs = 0
      var amount = last_amount+tick_amount
      unspents.forEach(function(unspent) {
        num_of_signs++
        value += unspent.value
        txb.addInput(unspent.transaction_hash, unspent.output_index)
      })
      if (value < amount + fee) {
        return cb('Out of money, needs '+amount+', but you have only '+(value-fee)+'. Please deposite more money...')
      }
      var local_address = local_private.pub.getAddress(network).toString()
      txb.addOutput(local_address, amount)
      txb.addOutput(return_address, value-amount-fee)
      var redeemScript = bitcoin.scripts.multisigOutput(2, public_keys)
      
      var tx = txb.buildIncomplete()
      session.last_unsign_txid = tx.getId()
      session.num_of_signs = num_of_signs
      session.save(function(err) {
        var ans = {
          tx_hex : tx.toHex(),
          redeem_script : redeemScript.toHex(),
          num_of_signs : num_of_signs,
        }
        return callback(err, ans)
      })
    }
  ],
  callback)
}

var send_signed_tick = function(req, res, next) {
  var params = req.data
  var sign_tx_hex = params.sign_tx_hex
  var multisig_address = params.multisig_address
  
  var tx = bitcoin.Transaction.fromHex(sign_tx_hex)
  var txid = tx.getId()
  async.waterfall([
    function(callback) {
      get_session(multisig_address, callback)
    },
    function(session, callback) {
//     if (session.last_unsign_txid == txid) {
        var last_amount = session.last_amount || 0
        session.last_amount = last_amount + tick_amount
        session.last_tx = sign_tx_hex
        session.save(callback)
//      }
//      else {
//        return callback('Wrong txid, in db: '+session.last_unsign_txid+', got: '+txid)
//      }
    }
  ],
  function (err) {
    if (err) return next(err)
    res.send('Succses!')
  })
}

var close_payment_chanel = function(req, res, next) {
  var params = req.data
  var multisig_address = params.multisig_address
  
  var last_amount
  
  async.waterfall([
    function(callback) {
      get_session(multisig_address, callback)
    },
    function(session, callback) {
      if (session) {
        if (session.last_tx) {
          var tx = bitcoin.Transaction.fromHex(session.last_tx)
          var txb = bitcoin.TransactionBuilder.fromTransaction(tx)
          
          var num_of_signs = session.num_of_signs
          var redeem_script = session.redeem_script
          last_amount = session.last_amount
          redeem_script = bitcoin.Script.fromHex(redeem_script)
          for (var i = 0; i < num_of_signs; i++) {
            txb.sign(i, local_private, redeem_script)
          }
          var payment_tx = txb.build()
          //var payment_tx = tx
          callback(null, payment_tx)
        }
        else {
          callback('No payment found for the session.')
        }
      }
      else {
        callback('No active session found.')
      }
    },
    function(payment_tx, callback) {
      chain.sendTransaction(payment_tx.toHex(), callback);
    }
    ],
  function (err, resp) {
    if (err) return next(err)
      resp.paied_amount = last_amount
    res.send(resp)
  })
}

module.exports = {
  get_multisig_address : get_multisig_address,
  get_account_balance : get_account_balance,
  tick : tick,
  send_signed_tick : send_signed_tick,
  close_payment_chanel : close_payment_chanel,
}

