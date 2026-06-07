sap.ui.define([], function () {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.hr7.requestforpickup.fragment.";
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
			var aItems = aSArray.filter(function (obj) {
				return obj[sColumn] === sKeyVal;
			});
			return aItems;
		},
		_getObjIndexInArray: function (aSArray, sColumn, sKeyVal) {
			var nIdx = aSArray.findIndex(function (obj) {
				return obj[sColumn] === sKeyVal;
			});
			return nIdx;
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
		/**
		 * Remove Dublicate object  in array
		 * @param: aSource
		 * @param: sColumn - col to check duplicate
		 * @return unique array
		 * @last modified: Michael 04/12/2024
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