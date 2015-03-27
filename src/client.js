var bitcoin = require('bitcoinjs-lib');
var qr = require('qr-encode');

module.exports = {
  
  getNewPrivateKey: function(network) {
    
    var priv = bitcoin.ECKey.makeRandom();
    if (network === 'testnet')
      return priv.toWIF(bitcoin.networks.testnet);
    else
      return priv.toWIF(bitcoin.networks.bitcoin);
  },
  
  get_pub_from_priv: function(priv_key) {
    var pub_key = bitcoin.ECKey.fromWIF(priv_key).pub.toHex();
    return pub_key;
  },

  getQR: function(data,sizeOfImg,errorLevel) {
    
    var dataURI = qr(data, {type: sizeOfImg, size: sizeOfImg, level: errorLevel})
    
    //If using in browsers:
    if (typeof window !== 'undefined') {
      var img = new Image();
      img.src = dataURI;
      return img;
    }
    else return dataURI;
  },

  signTransaction: function(data,privateKey) {
    var tx_hex = data.tx_hex;
    var redeem_script = data.redeem_script;
    var num_of_signs = data.num_of_signs;
    var privateKey_object = bitcoin.ECKey.fromWIF(privateKey)

    var tx = bitcoin.Transaction.fromHex(tx_hex)
    var txb = bitcoin.TransactionBuilder.fromTransaction(tx)
              
    redeem_script = bitcoin.Script.fromHex(redeem_script)
    for (var i = 0; i < num_of_signs; i++) {
      txb.sign(i, privateKey_object, redeem_script)
    }
    
    var payment_tx = txb.buildIncomplete()
    return payment_tx.toHex();
  }
  
}
