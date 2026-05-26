sap.ui.define([], function () {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.sls.disputesls.fragment.";
	return {

		DISPUTE_STATUS_LIST: [{
			code: "A",
			description: "Approved",
			state: "Success"
		}, {
			code: "AD",
			description: "Adjustment",
			state: "None"
		}, {
			code: "C",
			description: "Completed",
			state: "Success"
		}, {
			code: "CN",
			description: "Canceled",
			state: "Error"
		}, {
			code: "D",
			description: "Dispute",
			state: "Warning"
		}, {
			code: "DL",
			description: "Deleted",
			state: "None"
		}, {
			code: "DN",
			description: "Denied",
			state: "None"
		}, {
			code: "IP",
			description: "In Process",
			state: "Warning"
		}, {
			code: "M",
			description: "Manually Released",
			state: "Warning"
		}, {
			code: "O",
			description: "Open",
			state: "None"
		}, {
			code: "R",
			description: "Released",
			state: "Success"
		}, {
			code: "RS",
			description: "Resolved",
			state: "Success"
		}],

		getFragment: function (sFragmentId, sFragmentName, oController) {
			var oView = oController.getView();
			if (!oController.hasOwnProperty("fragments")) {
				oController.fragments = {};
			}

			var oFragment = oController.fragments[sFragmentName];
			if (oFragment === undefined) {
				var sId = "";
				if (sFragmentId) {
					sId = oView.createId(sFragmentId);
				} else {
					sId = oView.getId();
				}
				oFragment = sap.ui.xmlfragment(sId, sNameSpace + sFragmentName, oController);
				oController.fragments[sFragmentName] = oFragment;
				oView.addDependent(oFragment);
			}
			return oFragment;
		}
	};
});