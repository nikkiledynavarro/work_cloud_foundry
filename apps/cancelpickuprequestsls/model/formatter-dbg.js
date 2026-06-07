sap.ui.define([], function () {
	"use strict";

	return {
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.hr7.cancelpickuprequest");
			return sRootPath + "/image/shiperp_logo.png";
		}
	};
});