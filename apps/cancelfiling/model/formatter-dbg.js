sap.ui.define([], function () {
	"use strict";

	return {
		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.hr7.cancelfiling");
			return sRootPath + "/image/shiperp_logo.png";
		},
		formatDateTime: function (sDate) {
			if (sDate) {
				var data = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "MM/dd/yyyy"
				});
				return data.format(new Date(sDate));
			} else {
				return sDate;
			}
		},
	};
});