sap.ui.define([
	"com/erpis/shiperp/sls/cancelshipment/common/Utils"
], function (Utils) {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.sls.cancelshipment");
			return sRootPath + "/image/shiperp_logo.png";
		}

	};

});