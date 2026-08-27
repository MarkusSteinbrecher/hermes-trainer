/* HERMES-Trainer — localStorage-Kapsel.
   Jeder Zugriff in try/catch; die App funktioniert auch ohne Storage
   (Privatmodus, deaktivierte Cookies, voller Speicher). */
(function (global) {
  'use strict';

  var HT = global.HT = global.HT || {};
  var PRAEFIX = 'hermes-trainer:';

  function raw() {
    try {
      return global.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  var verfuegbar = (function () {
    try {
      var s = raw();
      if (!s) { return false; }
      var probe = PRAEFIX + '__probe';
      s.setItem(probe, '1');
      s.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }());

  HT.store = {
    verfuegbar: verfuegbar,

    lies: function (schluessel, standard) {
      try {
        var s = raw();
        if (!s) { return standard; }
        var text = s.getItem(PRAEFIX + schluessel);
        if (text === null || text === undefined) { return standard; }
        var wert = JSON.parse(text);
        return (wert === null || wert === undefined) ? standard : wert;
      } catch (e) {
        return standard;
      }
    },

    schreib: function (schluessel, wert) {
      try {
        var s = raw();
        if (!s) { return false; }
        s.setItem(PRAEFIX + schluessel, JSON.stringify(wert));
        return true;
      } catch (e) {
        return false;
      }
    },

    loesche: function (schluessel) {
      try {
        var s = raw();
        if (!s) { return false; }
        s.removeItem(PRAEFIX + schluessel);
        return true;
      } catch (e) {
        return false;
      }
    }
  };
}(window));
