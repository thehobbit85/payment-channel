var bitcoin = require('bitcoinjs-lib')
var async = require('async')
var Chain = require('chain-node')
 
function PaymentChannel(options) {
  this.network = options.network || bitcoin.networks.testnet
  this.chain = new Chain(options.chain)
  this.fee = options.fee || 1000
  this.tickAmount = options.tickAmount || 600
}

PaymentChannel.prototype.getNewMultisigObject = function(firstPublicKey,secondPublicKey) {
  
  var multiSigData = this.getMultisigFromPublicKeys(firstPublicKey,secondPublicKey)

  if (multiSigData && multiSigData.address) {
    var data = {
      multisigAddress : multiSigData.address,
      publicKeys : multiSigData.pubKeys.map(function (x) {
        return x.toHex()
      }),
      redeemScript : multiSigData.redeemScript.toHex(),
      returnAddress : "", 
      lastAmount : 0,
      lastUnsignTxid : "",
      lastSignedTx : "",
      lastTickTx : "",
      firstTxId : "",
      numOfSigns : 0,
      balance : 0
    }
    return data
  }
  else return null
}

PaymentChannel.prototype.getMultisigFromPublicKeys = function(firstPublicKey,secondPublicKey) {
  var firstPublicKey = bitcoin.ECPubKey.fromHex(firstPublicKey)
    secondPublicKey = bitcoin.ECPubKey.fromHex(secondPublicKey),
    pubKeys = [firstPublicKey, secondPublicKey],
    redeemScript = bitcoin.scripts.multisigOutput(2, pubKeys), // 2 of 2
    scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash()),
    address = bitcoin.Address.fromOutputScript(scriptPubKey, this.network).toString()

  if (address) {
    return {
      pubKeys : pubKeys,
      redeemScript : redeemScript,
      address : address
    }
  }
  else {
    return 'address error'
  }
}

PaymentChannel.prototype.getAccountBalance = function(multisigAddress,cb) {
  
  var value = 0,
    firstTxId
  
  var self = this

  async.waterfall([
    function(callback) {
      self.chain.getAddressUnspents(multisigAddress.multisigAddress, callback)
    },
    function(utxos, callback) {
      utxos.forEach(function(utxo) {
        value+=utxo.value
      })
      if (value) {
        firstTxId = utxos[0].transaction_hash
      }
      callback(null ,firstTxId)
    },
    function(firstTxId, callback) {
      multisigAddress.balance = value
      if (firstTxId) {
        multisigAddress.firstTxId = firstTxId
        if (!multisigAddress.returnAddress || multisigAddress.returnAddress === "") {
          self.chain.getTransaction(firstTxId, callback)
        }
        else callback('error')
      }
      else callback('error')
    },
    function(res, callback) {
      multisigAddress.returnAddress = res.inputs[0].addresses[0]
      callback(null,multisigAddress)
    }
  ],
  cb)
}

PaymentChannel.prototype.createTick = function(multisigObject,receivingAddress, cb) {
  var unspents
  var self = this

  this.chain.getAddressUnspents(multisigObject.multisigAddress, function(err, unspents) {
    if (err) return cb(err)

    var publicKeys = multisigObject.publicKeys
    publicKeys = publicKeys.map(bitcoin.ECPubKey.fromHex)
    var returnAddress = multisigObject.returnAddress
    var lastAmount = multisigObject.lastAmount || 0
    var txb = new bitcoin.TransactionBuilder()
    var value = 0
    var numOfSigns = 0
    var amount = lastAmount+self.tickAmount
    unspents.forEach(function(unspent) {
      numOfSigns++
      value += unspent.value
      txb.addInput(unspent.transaction_hash, unspent.output_index)
    })
    if (value < amount + self.fee) {
      return callback('Out of money, needs '+amount+', but you have only '+(value-fee)+'. Please deposite more money...')
    }

    txb.addOutput(receivingAddress, amount)
    txb.addOutput(returnAddress, value-amount-self.fee)
   
    var tx = txb.buildIncomplete()
    multisigObject.lastUnsignTxid = tx.getId()
    multisigObject.numOfSigns = numOfSigns
    multisigObject.lastTickTx = tx.toHex()

    cb(null, multisigObject)
  })
}

PaymentChannel.prototype.closePaymentChannel = function(multisigObject,secondPrivateKey,cb) {

  var privateKeyObject = bitcoin.ECKey.fromWIF(secondPrivateKey)

  if (multisigObject.lastSignedTx) {
    var tx = bitcoin.Transaction.fromHex(multisigObject.lastSignedTx)
    var txb = bitcoin.TransactionBuilder.fromTransaction(tx)
    
    var numOfSigns = multisigObject.numOfSigns
    var redeemScript = multisigObject.redeemScript
    
    var lastAmount = multisigObject.lastAmount
    redeemScript = bitcoin.Script.fromHex(redeemScript)
    
    for (var i = 0; i < numOfSigns; i++) {
      txb.sign(i, privateKeyObject, redeemScript)
    }
    var paymentTx = txb.build()
    
    this.chain.sendTransaction(paymentTx.toHex(), cb)
  }
  else {
    cb('No payment found for the session.')
  }
}

PaymentChannel.prototype.firstSignTick = function(multisigAddress,firstPrivateKey,cb) {
  
  var privateKeyObject = bitcoin.ECKey.fromWIF(privateKey)

  var tx = bitcoin.Transaction.fromHex(multisigAddress.lastTickTx)
  var txb = bitcoin.TransactionBuilder.fromTransaction(tx)
            
  redeemScript = bitcoin.Script.fromHex(multisigAddress.redeemScript)
  for (var i = 0; i <  multisigAddress.numOfSigns; i++) {
    txb.sign(i, privateKeyObject, redeemScript)
  }
  
  var paymentTx = txb.buildIncomplete()  
  var lastAmount = multisigAddress.lastAmount || 0

  multisigAddress.lastAmount = lastAmount + this.tickAmount
  multisigAddress.lastSignedTx = paymentTx.toHex()
  
  cb(null,multisigAddress)
}


module.exports = PaymentChannel;

