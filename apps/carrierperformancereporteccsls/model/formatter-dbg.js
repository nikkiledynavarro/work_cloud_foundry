sap.ui.define([], function () {
	"use strict";

	return {
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.carrierperformancereportecc");
			return sRootPath + "/image/shiperp_logo.png";
		},

		_formatDateObject: function (sDate) {
			var year = sDate.substring(0, 4);
			var month = sDate.substring(4, 6);
			var day = sDate.substring(6, 8);

			return sDate = year + '-' + month + '-' + day;
		},
	};
});