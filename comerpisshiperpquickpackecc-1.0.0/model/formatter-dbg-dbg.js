sap.ui.define([], function () {
	"use strict";

	return {

		/**
		 * Rounds the number unit value to 2 digits
		 * @public
		 * @param {string} sValue the number string to be rounded
		 * @returns {string} sValue with 2 digits rounded
		 */
		numberUnit: function (sValue) {
			if (!sValue) {
				return "";
			}
			return parseFloat(sValue).toFixed(2);
		},

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.quickpackecc");
			return sRootPath + "/image/shiperp_logo.png";
		},

		removeLeadingZero: function (sString) {
			try {
				// if is char degit
				if (!!sString.trim() && sString * 0 === 0) {
					return parseInt(sString, 10);
				}
				return sString;
			} catch (exc) {
				return "";
			}
		},

		getScenarioText: function (sScenario) {
			var aScenario = {
				"1": "Delivery",
				"2": "Shipment"
			};
			var oBundle = this.getResourceBundle();
			return oBundle.getText(aScenario[sScenario]) || "";
		},

		statusIcon: function (iQuantity, iBalance) {
			iQuantity = parseInt(iQuantity, 10);
			iBalance = parseInt(iBalance, 10);
			if (iQuantity === iBalance) {
				return "sap-icon://status-negative";
			} else if (iQuantity > iBalance && iBalance > 0) {
				return "sap-icon://status-critical";
			} else {
				return "sap-icon://status-positive";
			}
		},

		statusColor: function (iQuantity, iBalance) {
			iQuantity = parseInt(iQuantity, 10);
			iBalance = parseInt(iBalance, 10);
			if (iQuantity === iBalance) {
				return "Negative";
			} else if (iQuantity > iBalance && iBalance > 0) {
				return "Critical";
			} else {
				return "Positive";
			}
		}

	};

});