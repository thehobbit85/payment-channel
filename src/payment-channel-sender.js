var bitcoin = require('bitcoinjs-lib')
var util = require('util')
var PaymentChannel = require('./payment-channel-new')

function Sender (options) {
  PaymentChannel.call(this, options)
}

util.inherits(Sender, PaymentChannel)

Sender.prototype.send = function (amount, cb) {
  // var unspents
  var self = this
  var receivingAddress = this.counterPartyAddress

  this.chain.getAddressUnspents(this.multisigAddress, function (err, unspents) {
    if (err) return cb(err)
    amount = amount || self.tickAmount
    var publicKeys = self.publicKeys
    publicKeys = publicKeys.map(bitcoin.ECPubKey.fromHex)
    var returnAddress = self.returnAddress
    var lastAmount = self.lastAmount || 0
    var txb = new bitcoin.TransactionBuilder()
    var value = 0
    amount = amount + lastAmount
    unspents.forEach(function (unspent) {
      value += unspent.value
      txb.addInput(unspent.transaction_hash, unspent.output_index)
    })
    if (value < amount + self.fee) {
      return cb(new Error('Out of money, needs ' + amount + ', but you have only ' + (value - self.fee) + '. Please deposite more money...'))
    }

    txb.addOutput(receivingAddress, amount)
    txb.addOutput(returnAddress, value - amount - self.fee)

    var tx = txb.buildIncomplete()
    self.lastAmount = amount
    var signedTx = firstSignOnTx(self.privateKey, tx.toHex(), self.redeemScript)

    self.emit('send', signedTx, self)
    cb(null, signedTx)
  })
}

var firstSignOnTx = function (privateKey, txHex, redeemScript) {
  var privateKeyObject = bitcoin.ECKey.fromWIF(privateKey)
  var tx = bitcoin.Transaction.fromHex(txHex)
  var txb = bitcoin.TransactionBuilder.fromTransaction(tx)

  redeemScript = bitcoin.Script.fromHex(redeemScript)
  for (var i = 0; i < tx.ins.length; i++) {
    txb.sign(i, privateKeyObject, redeemScript)
  }

  var paymentTx = txb.buildIncomplete()

  return paymentTx.toHex()
}

module.exports = Sender
