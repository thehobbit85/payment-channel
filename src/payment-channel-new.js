var bitcoin = require('bitcoinjs-lib')
var Chain = require('chain-node')
var qr = require('qr-encode')
var events = require('events')
 
function PaymentChannel(options) {
  this.network = bitcoin.networks[options.chain.blockChain]
  this.chain = new Chain(options.chain)
  this.fee = options.fee || 1000
  this.tickAmount = options.tickAmount || 600
  this.privateKey = options.privateKey || bitcoin.ECKey.makeRandom().toWIF(this.network)
  this.publicKey = bitcoin.ECKey.fromWIF(this.privateKey).pub.toHex()
  this.counterPartyPublicKey  = options.counterPartyPublicKey
  var multiSigData = getMultisigFromPublicKeys(this.publicKey,this.counterPartyPublicKey)
  this.multisigAddress = multiSigData.address
  this.publicKeys = multiSigData.pubKeys.map(function (x) {
    return x.toHex()
  })
  this.redeemScript = multiSigData.redeemScript.toHex()
  this.returnAddress = options.returnAddress
  this.counterPartyAddress = options.counterPartyAddress
  this.lastAmount = 0
  this.lastSignedTx = ""
  this.balance = 0
}

util.inherits(PaymentChannel, events.EventEmitter)

var getMultisigFromPublicKeys = function(myPublicKey,secondPartyPublicKey) {

  var firstPublicKey = bitcoin.ECPubKey.fromHex(myPublicKey),
    secondPublicKey = bitcoin.ECPubKey.fromHex(secondPartyPublicKey),
    pubKeys = [firstPublicKey, secondPublicKey],
    redeemScript = bitcoin.scripts.multisigOutput(2, pubKeys), // 2 of 2
    scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash()),
    address = bitcoin.Address.fromOutputScript(scriptPubKey, this.network).toString()

  return {
    pubKeys : pubKeys,
    redeemScript : redeemScript,
    address : address
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
    self.balance = value

    if (utxos.length > 0) {
      firstTxId = utxos[0].transaction_hash 
    }

    if (firstTxId) {
      if (!self.returnAddress) {
        self.chain.getTransaction(firstTxId, function(err,res){
          if (err) cb(err)
          self.returnAddress = res.inputs[0].addresses[0]
          self.emit("balance.synced", self.balance, self)
          cb(null,self)
        })
      }
      else {
        self.emit("balance.synced", self.balance, self)
        cb(null,self)
      }
    }
    else cb(new Error('error'))
  })
}

module.exports = PaymentChannel