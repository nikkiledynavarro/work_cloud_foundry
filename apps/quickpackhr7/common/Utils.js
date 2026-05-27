sap.ui.define([], function () {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.quickpack.hr7.fragment.";
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
		 * Get object exist in array
		 * @param: aSArray
		 * @param: sColumn - col to search
		 * @param: sKeyVal - val to search
		 * */
		_getExistingArray: function (aSArray, sColumn, sKeyVal) {
			var aFound = aSArray.filter(function (obj) {
				return obj[sColumn] === sKeyVal;
			});
			return aFound[0];
		},
		_getExistingArrayTwoCol: function (aSArray, sCol1, sKey1, sCol2, sKey2) {
			var aFound = aSArray.filter(function (obj) {
				return (obj[sCol1] === sKey1 && obj[sCol2] === sKey2);
			});
			return aFound[0];
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
		handleAllTrackShipped: function (aFreightItems, oController) {
			var isAllTrackShipped = false;

			//Check track only have shipment Ax 4770
			if (aFreightItems.length > 0) {
				isAllTrackShipped = true;
				var aItemNoTracks = this._getExistingArray(aFreightItems, "TrackingNumber", "");
				if (aItemNoTracks !== undefined) {
					isAllTrackShipped = false;
				}
			}
			oController.getModel("local").setProperty("/isAllTrackShipped", isAllTrackShipped);

		}
	};
});