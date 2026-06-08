sap.ui.define([
	"sap/ui/base/Object"
], function(ui5Object) {
	"use strict";
	var HotkeyInterface = ui5Object.extend("com.erpis.shiperp.sls.quickpacksls.common.hotkeyInterface", {
		constructor: function(oComponent) {
			this.oComponent = oComponent;
		},

		bindHotKeys: function(combinations) {
			combinations.forEach(function(mItem) {
				// First Remove if that keycombinaiton is availble already, as we only will have at a time one
				this.unBindHotKey(mItem.keyCombination);
				// Now call the actual binding
				this.bindHotKey(mItem.keyCombination, mItem.control, mItem.fnHandler, mItem.hanlder);
			}, this);
		},

		bindHotKey: function(keyCombination, control, fnHandler, hanlder) {
			$(document).bind("keydown." + this.getNameSpace(keyCombination), keyCombination, function(oEvent) {
				if (control && control.getDomRef() && control.getDomRef().getBoundingClientRect()) {
					// Check if the control is visible in DOM currently, 
					// sometimes,the control might be hidden becuase of a tab change or view change
					var aMargin = control.getDomRef().getBoundingClientRect();
					if (aMargin.width) { // If the width is availble, then it is visible
						fnHandler.call(this, oEvent, control);
					}
				}
			}.bind(hanlder));
		},

		unBindHotKeys: function(keyCombinations) {
			// Remove the hotkeys
			keyCombinations.forEach(function(mItem) {
				this.unBindHotKey(mItem.keyCombination);
			}, this);
		},

		unBindHotKey: function(keyCombination) {
			$(document).unbind("keydown." + this.getNameSpace(keyCombination));
		},

		getNameSpace: function(keyCombination) {
			// Create a unique key for the hotkey we are using
			return "pocApplication_" + keyCombination.replace("+", "_");
		}
	});

	return {
		getInstance: function(oComponent) {
			// Singleton
			if (!this.instance) {
				this.instance = new HotkeyInterface(oComponent);
			}
			return this.instance;
		}
	};

});