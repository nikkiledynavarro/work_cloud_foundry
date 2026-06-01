sap.ui.define([], function () {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.closedelivery");
			return sRootPath + "/image/shiperp_logo.png";
		},

		numberUnit: function (sValue) {
			if (!sValue) {
				return "";
			}
			return parseFloat(sValue).toFixed(2);
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

		getStateForParentNode: function (oData) {
			if (oData && oData.Children.length > 0) {
				return "Success";
			}
			return "None";
		}

	};

});