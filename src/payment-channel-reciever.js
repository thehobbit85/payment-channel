var bitcoin = require('bitcoinjs-lib')
var util = require('util')
var PaymentChannel = require('./payment-channel-new')

function Receiver(options) {
  PaymentChannel.call(this, options)
}

util.inherits(Receiver, PaymentChannel)

Receiver.prototype.receive = function(txHex, cb) {
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

    self.emit("receive", diff, self.lastAmount, self)
    cb(null, diff)
  })
}

Receiver.prototype.close = function(cb) {

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
    
    this.chain.sendTransaction(paymentTx.toHex(), function(err, data) {
      if (err) return cb(err)
      self.emit("close", data, self)
      cb(null, data)
    })
  }
  else {
    cb(new Error('No payment found for the session.'))
  }
}

module.exports = Receiver