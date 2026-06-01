sap.ui.define([], function () {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.saleorder.fragment.";
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
		_getExistItemsArray: function (aSArray, sColumn, sKeyVal) {
			var aResults = [];
			var aItems = aSArray.filter(function (obj) {
				return obj[sColumn] === sKeyVal;
			});
			if (aItems.length > 0) {
				aResults = aItems;
			}
			return aResults;
		},
		_checkExistingArray: function (aSArray, sColumn, sKeyVal) {
			var aFound = aSArray.filter(function (obj) {
				return obj[sColumn] === sKeyVal;
			});
			return aFound[0];
		},
		/**
		 * Remove Dublicate object  in array
		 * @param: aSource
		 * @param: sColumn - col to check duplicate
		 * @return unique array
		 * @last modified: Tim 30/8/2021
		 * */
		_removeDuplicateObjInArr: function (aSource, sColumn) {
			var oUniqObj = {};
			//get uniq keys
			for (var i = 0, len = aSource.length; i < len; i++) {
				oUniqObj[aSource[i][sColumn]] = aSource[i];
			}

			//get uniq item by uniq keys
			aSource = new Array();
			for (var key in oUniqObj)
				aSource.push(oUniqObj[key]);

			return aSource;

		},
	};
});