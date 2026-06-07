sap.ui.define([], function () {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.quickpackewm.fragment.";
	return {
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
		},

		/**
		 * Method to convert javascript datetime object to String
		 * @base
		 */
		convertDateTimeObjectToABAPString: function (oDate, sType) {
			var sYear = oDate.getFullYear().toString();
			var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
			var sDay = ("0" + oDate.getDate()).slice(-2);
			if (sType === "from") {
				return sYear + sMonth + sDay + "000000";
			}
			if (sType === "to") {
				return sYear + sMonth + sDay + "235959";
			}
			return sYear + sMonth + sDay;
		},

		_addPrefixToFieldName: function (aSource, prefix) {
			for (var i = 0, len = aSource.length; i < len; i++) {
				aSource[i].fieldName = aSource[i].fieldName.replaceAll(prefix, "");
				aSource[i].fieldName = prefix + aSource[i].fieldName;
				if (aSource[i].fieldPName !== "") {
					aSource[i].fieldPName = aSource[i].fieldPName.replaceAll(prefix, "");
					aSource[i].fieldPName = prefix + aSource[i].fieldPName;
				}
			}
			return aSource;
		},
		_getExistItemsArray: function (aSArray, sColumn, sKeyVal) {
			var aItems = aSArray.filter(function (obj) {
				return obj[sColumn] === sKeyVal;
			});
			return aItems;
		},
	};
});