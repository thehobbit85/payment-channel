var bitcoin = require('bitcoinjs-lib')
var Chain = require('chain-node')
var qr = require('qr-encode')
 
function PaymentChannel(options) {
  this.network = bitcoin.networks[options.chain.blockChain]
  this.chain = new Chain(options.chain)
  this.fee = options.fee || 1000
  this.tickAmount = options.tickAmount || 600
  this.privateKey = options.privateKey || bitcoin.ECKey.makeRandom().toWIF(this.network)
  this.publicKey = bitcoin.ECKey.fromWIF(privateKey).pub.toHex()
  var multiSigData = getMultisigFromPublicKeys(this.publicKey,options.counterPartyPublicKey)
  this.multisigAddress = multiSigData.address
  this.publicKeys = multiSigData.pubKeys.map(function (x) {
    return x.toHex()
  })
  this.redeemScript = multiSigData.redeemScript.toHex()
  this.returnAddress = options.returnAddress
  this.counterPartyAddress = options.counterPartyAddress
  this.lastAmount = 0
  this.lastSignedTx = ""
  this.firstTxId = ""
  this.balance = 0
}

var getMultisigFromPublicKeys = function(myPublicKey,secondPartyPublicKey) {

  var firstPublicKey = bitcoin.ECPubKey.fromHex(myPublicKey),
    secondPublicKey = bitcoin.ECPubKey.fromHex(secondPartyPublicKey),
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
    throw 'address error'
  }
}

PaymentChannel.getQR = function(data,type,size,level) {
    
  var dataURI = qr(data, {type: type, size: size, level: level})

  //If using in browsers:
  if (typeof window !== 'undefined') {
    var img = new Image()
    img.src = dataURI
    return img
  }
  else return dataURI
}

PaymentChannel.prototype.getAccountBalance = function(cb) {
  
  var value = 0,
    firstTxId,
    self = this
  
  this.chain.getAddressUnspents(this.multisigAddress, function(err, utxos){
    if (err) return cb(err)
    utxos.forEach(function(utxo) {
      value+=utxo.value
    })
    if (value) {
      firstTxId = utxos[0].transaction_hash
      self.balance = value
    }
    if (!firstTxId) {
      self.firstTxId = firstTxId
      if (!self.returnAddress || self.returnAddress === "") {
        self.chain.getTransaction(firstTxId, function(err,res){
          if (err) cb(err)
          self.returnAddress = res.inputs[0].addresses[0]
          cb(null,self)
        })
      }
      else cb(null,self)
    }
    else cb(new Error('error'))
  })
}

PaymentChannel.prototype.send = function(amount, cb) {
  
  var unspents,
    self = this,
    receivingAddress = this.counterPartyAddress

  this.chain.getAddressUnspents(this.multisigAddress, function(err, unspents) {
    if (err) return cb(err)
    amount = amount || self.tickAmount
    var publicKeys = self.publicKeys
    publicKeys = publicKeys.map(bitcoin.ECPubKey.fromHex)
    var returnAddress = self.returnAddress
    var lastAmount = self.lastAmount || 0
    var txb = new bitcoin.TransactionBuilder()
    var value = 0
    amount = amount + lastAmount
    unspents.forEach(function(unspent) {
      value += unspent.value
      txb.addInput(unspent.transaction_hash, unspent.output_index)
    })
    if (value < amount + self.fee) {
      return callback(new Error('Out of money, needs '+amount+', but you have only '+(value-fee)+'. Please deposite more money...'))
    }

    txb.addOutput(receivingAddress, amount)
    txb.addOutput(returnAddress, value-amount-self.fee)
   
    var tx = txb.buildIncomplete()
    self.lastAmount = amount
    
    cb(null, firstSignOnTx(self.privateKey, tx.toHex(), self.redeemScript))
  })
}

PaymentChannel.prototype.receive = function(txHex, cb) {
  var transaction = bitcoin.Transaction.fromHex(txHex),
    totalIn = 0,
    totalOut = 0,
    totalMine = 0,
    self = this

  this.chain.getAddressUnspents(this.multisigAddress, function(err, unspents) {
    var outputMap = {}
    for (var i=0; i < unspents.length; i++) {
      outputMap[unspents[i].transaction_hash+':'+unspents[i].output_index] = unspents[i] 
    }
    transaction.ins.forEach(function(inv) {
      if (!outputMap[inv.hash+':'+inv.index])
         return cb(new Error('All hell broke loss and dunno'))
      totalIn += outputMap[inv.hash+':'+inv.index].value
      delete outputMap[inv.hash+':'+inv.index]
    })
    transaction.outs.forEach(function(out) {
      var outAdress = bitcoin.Address.fromOutputScript(out.script, self.network).toString()
      if (self.returnAddress === outAdress)
        totalMine += out.value
      totalOut += out.value
    }) 
    if (totalIn < totalOut + self.fee)
      return cb(new Error('All hell broke loss and no mo money'))
    
    var diff = totalMine - self.lastAmount

    if (diff < 0) 
      return cb(new Error('All hell broke loss bitch got robed'))
    
    self.lastAmount = totalMine
    self.lastSignedTx = txHex

    cb(null, diff)
  })
}

var firstSignOnTx = function(privateKey, txHex, redeemScript) {
  
  var privateKeyObject = bitcoin.ECKey.fromWIF(privateKey)
  var tx = bitcoin.Transaction.fromHex(txHex)
  var txb = bitcoin.TransactionBuilder.fromTransaction(tx)
            
  redeemScript = bitcoin.Script.fromHex(redeemScript)
  for (var i = 0; i <  tx.ins.length; i++) {
    txb.sign(i, privateKeyObject, redeemScript)
  }
  
  var paymentTx = txb.buildIncomplete()  

  return paymentTx.toHex()
}

PaymentChannel.prototype.close = function(cb) {

  var privateKeyObject = bitcoin.ECKey.fromWIF(this.privateKey)

  if (this.lastSignedTx) {
    var tx = bitcoin.Transaction.fromHex(this.lastSignedTx)
    var txb = bitcoin.TransactionBuilder.fromTransaction(tx)
  
    var redeemScript = this.redeemScript
    
    var lastAmount = this.lastAmount
    redeemScript = bitcoin.Script.fromHex(redeemScript)
    
    for (var i = 0; i < tx.ins.length; i++) {
      txb.sign(i, privateKeyObject, redeemScript)
    }
    var paymentTx = txb.build()
    
    this.chain.sendTransaction(paymentTx.toHex(), cb)
  }
  else {
    cb(new Error('No payment found for the session.'))
  }
}

module.exports = PaymentChannel