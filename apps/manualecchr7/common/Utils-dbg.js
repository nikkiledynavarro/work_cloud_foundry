sap.ui.define([], function () {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.manualecc.hr7.fragment.";
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
		isEmpty: function (value) {
			if (typeof value === "string") {
				if (value !== "" && value !== undefined) {
					return false;
				}
			}
			if (typeof value === "number") {

				return false;

			}
			if (typeof value === "object") {

				return false;

			}
			return true;
		},
		isEmptyArray: function (value) {
			if (Array.isArray(value)) {
				if (value.length > 0) {
					return false;
				}
				return true;
			}
			return false;
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
		/**
		 * Check String exist in array
		 * @param: aSArray
		 * @param: sVal - val to search
		 * */
		_checkExistStringArray: function (aSArray, sVal) {
			var iIdx = aSArray.indexOf(sVal);
			var bExist = false;
			if (iIdx !== -1) {
				bExist = true;
			}
			return bExist;
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
		_addPrefixToFieldName: function (aSource, prefix) {
			for (var i = 0, len = aSource.length; i < len; i++) {
				aSource[i].FieldName = aSource[i].FieldName.replaceAll(prefix, "");
				aSource[i].FieldName = prefix + aSource[i].FieldName;
				if (aSource[i].FieldPName !== "") {
					aSource[i].FieldPName = aSource[i].FieldPName.replaceAll(prefix, "");
					aSource[i].FieldPName = prefix + aSource[i].FieldPName;
				}

			}
			return aSource;
		},
		/**
		 * Sample this.treeify(aTempOutput, "node_id", "parent_id","Children");
		 * */
		buildTreeify: function (list, idAttr, parentAttr, childrenAttr) {
				if (!idAttr) {
					idAttr = 'NodeId';
				}
				if (!parentAttr) {
					parentAttr = 'HeirLvl';
				}
				if (!childrenAttr) {
					childrenAttr = 'Children';
				}

				var treeList = [];
				var lookup = {};
				list.forEach(function (obj) {
					lookup[obj[idAttr]] = obj;
					obj[childrenAttr] = [];
				});
				list.forEach(function (obj) {
					if (obj[parentAttr] !== 0) {
						lookup[obj[parentAttr]][childrenAttr].push(obj);
					} else {
						treeList.push(obj);
					}
				});
				return treeList;
			} //end
	};
});