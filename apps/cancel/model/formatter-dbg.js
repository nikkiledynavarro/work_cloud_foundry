sap.ui.define([
	"com/erpis/shiperp/cancel/common/Utils"
], function (Utils) {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.cancel");
			return sRootPath + "/image/shiperp_logo.png";
		}

	};

});