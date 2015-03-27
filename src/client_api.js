var createKeysAndQR = function(cb) {

  if (!localStorage.getItem("privateKey")) {
    var privateKey = window.microstream.getNewPrivateKey('bitcoin');
    var publicKey = window.microstream.get_pub_from_priv(privateKey);
    localStorage.setItem("privateKey", privateKey);
    localStorage.setItem("publicKey", publicKey);
  }

  if (!localStorage.getItem("multisig_address")) {
    $.post( "/get_multisig_address", {public_key : localStorage.getItem("publicKey")})
        .done(function( multisig_address ) {
          localStorage.setItem("multisig_address", multisig_address);
          var qrcode = window.microstream.getQR(multisig_address,4,'Q');
          return cb(qrcode,multisig_address);
        });
  }
  else {
     var multisig_address = localStorage.getItem("multisig_address");
     var qrcode = window.microstream.getQR(multisig_address,4,'Q');
     return cb(qrcode,multisig_address);
  }
}

var getBalance = function(cb) {
  $.post( "/get_account_balance", {multisig_address : localStorage.getItem("multisig_address")})
      .done(function( data ) {
        var balance = data.balance;
        var used = data.used;
        if (!balance || balance == 0) {
          return getBalance(cb);
        }
        else {
          cb(balance,used);
        }
      });
}

var sendTick = function(cb) {
  $.post( "/tick", {multisig_address : localStorage.getItem("multisig_address")})
      .done(function( data ) {
        var signedHex = window.microstream.signTransaction(data,localStorage.getItem("privateKey"));
        $.post( "/send_signed_tick", {sign_tx_hex : signedHex, multisig_address : localStorage.getItem("multisig_address")})
          .done(function( answer ) {
            cb(answer);
          });
      });
}

var close_payment_chanel = function(cb) {
  $.post( "/close_payment_chanel", {multisig_address : localStorage.getItem("multisig_address")})
      .done(function( answer ) {
        cb(answer)
      });
}
var start_paying = function(videoId,cb) {
  var temp = 0;
  var video = document.getElementById(videoId)
  video.addEventListener("timeupdate", function () {
    var intTime = parseInt(this.currentTime)
    if(intTime%5 == 0 && intTime != temp){
      temp = intTime;
    sendTick(cb);
    }
  });
}

var stop_paying = function(videoId,cb) {
  var video = document.getElementById(videoId)
  video.removeEventListener("timeupdate", cb);
}


$(document).ready(function() {
  var microStream = {
    ui:getUiAPI()
  };

  microStream.ui.addMainPageListeners();

});

