sap.ui.define([
	"com/erpis/shiperp/cancelshipewm/hr7/common/Utils"
], function (Utils) {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.cancelshipewm.hr7");
			return sRootPath + "/image/shiperp_logo.png";
		},
		
		mpsTypeCheck: function (msp) {
			if (msp === "02") {
				return " /Multi"; 
			} else if (msp === "01") {
				return " /Single";
			}
			return "";
		},

	};

});