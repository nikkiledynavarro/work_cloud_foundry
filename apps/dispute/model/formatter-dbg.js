sap.ui.define([
	"sap/ui/core/ValueState",
	"com/erpis/shiperp/dispute/common/Utils"
], function (ValueState, Utils) {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.dispute");
			return sRootPath + "/image/shiperp_logo.png";
		},

		formatDisputeStatus: function (sStatus) {
			for (var i = 0; i < Utils.DISPUTE_STATUS_LIST.length; i++) {
				var oItem = Utils.DISPUTE_STATUS_LIST[i];
				if (oItem.code === sStatus) {
					return oItem.description;
				}
			}

			return sStatus;
		},

		formatDisputeStatusState: function (sStatus) {
			for (var i = 0; i < Utils.DISPUTE_STATUS_LIST.length; i++) {
				var oItem = Utils.DISPUTE_STATUS_LIST[i];
				if (oItem.code === sStatus) {
					return oItem.state;
				}
			}

			return "None";
		},

		formatDateString: function (sDateString) {
			//To be same with ABAP datum data type, sDateString should have format YYYYMMDD
			if (!sDateString || sDateString.length !== 8 || sDateString === "00000000") {
				return "";
			} else {
				var sYear = sDateString.substring(0, 4);
				var sMonth = sDateString.substring(4, 6);
				var sDate = sDateString.substring(6, 8);
				return sMonth + "/" + sDate + "/" + sYear;
			}
		}
	};

});