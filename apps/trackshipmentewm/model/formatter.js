sap.ui.define([], function () {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.trackshipmentewm.hr7");
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
		},

		formatDate: function (sDate) {
			if (sDate) {
				var data = new Date(sDate);
				var sDisplay = data.toLocaleDateString('en-US', {
					weekday: 'long'
				});
				return sDisplay;
			}
		},
		formatTime: function (value) {
			return value.match(/(\d{2})H(\d{2})M(\d{2})S$/).slice(-3).join(":");
		}
	};
});