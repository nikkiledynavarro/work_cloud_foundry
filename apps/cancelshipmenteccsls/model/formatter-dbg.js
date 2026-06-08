sap.ui.define([
	"com/erpis/shiperp/cancel/hr7/common/Utils"
], function (Utils) {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.cancel.hr7");
			return sRootPath + "/image/shiperp_logo.png";
		}

	};

});