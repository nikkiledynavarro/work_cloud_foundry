sap.ui.define([], function() {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.hr7.viewacefiling.fragment.";
	return {
		getFragment: function(sFragmentId, sFragmentName, oController) {
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