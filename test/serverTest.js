var assert = require('assert')
var async = require('async')
var testParams = require('./testParams.json')
var bitcoin = require('bitcoinjs-lib')
var PaymentChannel = require (__dirname  + "/../src/payment-channel.js")
// var server = require (__direname  + "/app.js")

////////////////TestParams////////////////
var firstPrivateKeyWifUncompressed = testParams.firstPrivateKeyWifUncompressed
var secondPrivateKeyWifUncompressed = testParams.secondPrivateKeyWifUncompressed

var firstPrivateKeyWifCompressed = testParams.firstPrivateKeyWifCompressed
var secondPrivateKeyWifCompressed = testParams.secondPrivateKeyWifCompressed

var uncompressedFirstPublicKey = testParams.uncompressedFirstPublicKey
var uncompressedSecondPublicKey = testParams.uncompressedSecondPublicKey

var firstPublicKeyCompressed = testParams.firstPublicKeyCompressed
var secondPublicKeyCompressed = testParams.secondPublicKeyCompressed

var firstAddress = testParams.firstAddress
var secondAddress = testParams.secondAddress

var multisigAddressFromWeb = testParams.multisigAddressFromWeb
var redeemScriptFromWeb = testParams.redeemScriptFromWeb

var options = testParams.options
var multisigObject = {}
//////////////////////////////////////////

var app = new PaymentChannel(options)

async.waterfall([
  function(callback) {
    newMultisigObject = app.getNewMultisigObject(firstPublicKeyCompressed,secondPublicKeyCompressed,secondAddress)
    assert(newMultisigObject ,'Problem with data')
    assert(newMultisigObject.publicKeys[0] === firstPublicKeyCompressed,'Problem with firstPublicKey')
    assert(newMultisigObject.publicKeys[1] === secondPublicKeyCompressed,'Problem with secondPublicKey')
    assert(newMultisigObject.multisigAddress === multisigAddressFromWeb,'Problem with multisigAddress')
    assert(newMultisigObject.redeemScript === redeemScriptFromWeb,'Problem with redeemScript')
    console.log('Passed First tests with the following data: ')
    multisigObject = newMultisigObject
    console.log(newMultisigObject)
    callback()
  },
  function(callback) {
    app.getAccountBalance(multisigObject, function (err,data) {
      if (err) return console.log(err)

      assert(data ,'Problem with data')
      assert(data.returnAddress === '15wPJhwthAkBtUgx3qFEyCtnK7piuu6Xvr','Problem with returnAddress')
      assert(data.firstTxId === '300a9f23d26def68601e3952c236c6568623952469fa4e001a64d0dd9bd9c35c','Problem with firstTxId')
      assert(data.balance === 10000,'Problem with balance')

      console.log('Passed Second tests with the following data: ')
      multisigObject = data
      console.log(data)
      callback()
    })
  },
  function(callback) {
    app.createTick(multisigObject, firstPublicKeyCompressed, 5000, function (err,data) {
      if (err) return console.log(err)
      assert(data ,'Problem with data')
      assert(data.lastUnsignTxid === 'b76046924353a092ad251167ad4c59e0965b15701aaf5ce145dd25d7a692dbb2','Problem with lastUnsignTxid')
      assert(data.lastTickTx === '01000000015cc3d99bddd0641a004efa692495238656c636c252391e6068ef6dd2239f0a300000000000ffffffff0288130000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88aca00f0000000000001976a914362995a6e6922a04e0b832a80bc56c33709a42d288ac00000000','Problem with lastTickTx')
      assert(data.numOfSigns === 1,'Problem with numOfSigns')
      console.log('Passed Third tests with the following data: ')
      multisigObject = data
      console.log(data)
      callback()
    })
  }
],
function(err) {
  if (err) return console.log("TEST FAILED")
  return console.log("TEST SUCCEED")
})





