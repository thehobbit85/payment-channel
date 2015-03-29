var bitcoin = require('bitcoinjs-lib')
var paymentChannel = require (__dirname  + "src/payment-channel.js")
var app = require('express')
var socket.io = require('socket.io')
var db = require('db')

module.exports = function (options) {
  
  app.get(options.path + '/getMultisigFromPublicKeys',function(req,res,next) {

    var firstPublicKey = req.query.firstPublicKey,
     secondPublicKey = req.query.secondPublicKey

    options.paymentChannel.getMultisigFromPublicKeys(firstPublicKey,secondPublicKey, function (err, data) {
      db.insert('Sessions', data, null, function(err, res) {
        if (err) return next(err)
        res.send(data.multisigAddress)
      })
    })
  
  }

  app.get(options.path + '/getAccountBalance',function(req,res,next) {

    var multisigAddress = req.query.multisigAddress
      
    var sessions = db.get_model('Sessions')
    var conditions = {
      multisigAddress : multisigAddress
    }
    
  }

  app.listen(options.port || 80, function() {
    console.log('Server Started')
  })

}

// sudo browserify ./src/payment-channel.js > ./src/payment-channel.client.js
// sudo uglifyjs ./src/payment-channel.client.js > ./src/payment-channel.min.js