sap.ui.define([], function () {
	"use strict";
	var sNameSpace = "com.erpis.shiperp.freightaudit.hr7.fragment.";
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

		/**	//Common check cancel by Abbi 
		 * @params - screen : H: Header; D: Detail; S: Side by side
		 * @params - approval : approval status ["A", "AP", "D", "O"]; //Approved, Partially Approved, Dispute, Open
		 * @params - overall : overall status ["O", "R", "RP", "RE","RM"]; //Open, Released, Partially Released, Rejected, Multi Released
		 * createdBy: Tim 12/10/2021
		 * */
		checkCancelAvailableBySreen: function (screen, approval, overall) {
			var bOverallCancel = true;
			var bApprovalCancel = this._checkCancelAvailableByStatus(screen, approval);
			//double check with overall
			if (screen === "H") {
				bOverallCancel = this._checkCancelAvailableByStatus(screen, overall);
			}
			if (bOverallCancel && bApprovalCancel) {
				return true;

			}
			return false;
		},
		_checkCancelAvailableByStatus: function (screen, status) {
			var isCancelAvailable = false;
			if (!status) {
				return isCancelAvailable;
			}
			//not allowed status
			var aNotAlloweds = ["D", "RE"]; // Disputed, Rejected
			var aAlloweds = ["R", "O", "A"]; //Released, Open, Approved
			//Header
			if (screen === "H") {
				aNotAlloweds.push("RP", "RM"); //Disputed, Rejected, Partially Released,, Multi Released
				aAlloweds.push("AP"); //Open, Approved, PartiallyApproved
			}
			if (aNotAlloweds.includes(status)) {
				return isCancelAvailable;
			}

			if (aAlloweds.includes(status)) {
				isCancelAvailable = true; //allow cancel
				return isCancelAvailable;
			}
			return isCancelAvailable;
		},
		/*Common check Approve Axo 4684
		 * @params - screen : H: Header; D: Detail; S: Side by side
		 *  @params - approval : approval status ["A", "AP", "D", "O"]; //Approved, Partially Approved, Dispute, Open
		 * @params - overall : overall status ["O", "R", "RP", "RE","RM"]; //Open, Released, Partially Released, Rejected, Multi Released
		 * createdBy: Tim 21/10/2021
		 * */
		checkApproveAvailableBySreen: function (screen, approval, overall) {
			//set default by approval
			var initStateText = this._getOAStatusTextByCode(approval);
			var oCheck = {
				isAvailable: true,
				stateText: initStateText
			};

			var bOverallApprove = true;
			var bApprovalApprove = this._checkApproveAvailableByStatus(screen, approval);
			//double check with overall
			if (screen === "H") {
				bOverallApprove = this._checkApproveAvailableByStatus(screen, overall);
			}

			//available
			if (bOverallApprove && bApprovalApprove) {
				return oCheck;
			}
			//not available
			oCheck.isAvailable = false;
			if (overall && bApprovalApprove) {
				oCheck.stateText = this._getOAStatusTextByCode(overall);
			}
			return oCheck;
		},
		_checkApproveAvailableByStatus: function (screen, status) {
			var isApproveAvailable = false;
			if (!status) {
				return isApproveAvailable;
			}
			//not allowed status
			var aNotAlloweds = ["R", "D", "RE"]; //Released, Disputed, Rejected
			var aAlloweds = ["O", "A"]; //Open, Approved
			//Header
			if (screen === "H") {
				aNotAlloweds.push("RP", "RM"); //Released, Disputed, Rejected, Partially Released, Multi Released
				aAlloweds.push("AP"); //Open, Approved, PartiallyApproved
			}
			if (aNotAlloweds.includes(status)) {
				return isApproveAvailable;
			}

			if (aAlloweds.includes(status)) {
				isApproveAvailable = true; //allow cancel
				return isApproveAvailable;
			}
			return isApproveAvailable;
		},
		/*Common check Reject Axo 4688
		 * @params - screen : H: Header; D: Detail; S: Side by side
		 *  @params - approval : approval status ["A", "AP", "D", "O"]; //Approved, Partially Approved, Dispute, Open
		 * @params - overall : overall status ["O", "R", "RP", "RE","RM"]; //Open, Released, Partially Released, Rejected, Multi Released
		 * createdBy: Tim 22/10/2021
		 * */
		checkRejectAvailableBySreen: function (screen, approval, overall) {
			//set default by approval
			var initStateText = this._getOAStatusTextByCode(approval);
			var oCheck = {
				isAvailable: true,
				stateText: initStateText
			};

			var bOverallApprove = true;
			var bApprovalApprove = this._checkRejectAvailableByStatus(screen, approval);
			//double check with overall
			if (screen === "H") {
				bOverallApprove = this._checkRejectAvailableByStatus(screen, overall);
			}

			//available
			if (bOverallApprove && bApprovalApprove) {
				return oCheck;
			}
			//not available
			oCheck.isAvailable = false;
			if (overall && bApprovalApprove) {
				oCheck.stateText = this._getOAStatusTextByCode(overall);
			}
			return oCheck;
		},
		_checkRejectAvailableByStatus: function (screen, status) {
			var isRejectAvailable = false;
			if (!status) {
				return isRejectAvailable;
			}
			//not allowed status
			var aNotAlloweds = ["R", "D", "RE"]; //Released, Disputed, Rejected
			var aAlloweds = ["O", "A"]; //Open, Approved
			//Header
			if (screen === "H") {
				aNotAlloweds.push("RP", "RM"); //Released, Disputed, Rejected, Partially Released, Multi Released
				aAlloweds.push("AP"); //Open, Approved, PartiallyApproved
			}
			if (aNotAlloweds.includes(status)) {
				return isRejectAvailable;
			}

			if (aAlloweds.includes(status)) {
				isRejectAvailable = true; //allow cancel
				return isRejectAvailable;
			}
			return isRejectAvailable;
		},

		/**
		 * Check pressing Release button in Header	
		 * @params - approval : approval status ["A", "AP", "D", "O"]; //Approved, Partially Approved, Dispute, Open
		 * @params - overall : overall status ["O", "R", "RP", "RE","RM"]; //Open, Released, Partially Released, Rejected, Multi Released
		 */
		checkReleaseAvailableBySreen: function (screen, approval, overall) {
			//set default by approval
			var initStateText = this._getOAStatusTextByCode(approval);
			var oCheck = {
				isAvailable: true,
				stateText: initStateText
			};

			var bOverallApprove = true;
			var bApprovalApprove = this._checkReleaseAvailableByStatus(screen, approval);
			//double check with overall
			if (screen === "H") {
				bOverallApprove = this._checkReleaseAvailableByStatus(screen, overall);
			}
			//Axo 4687 #3 specify allow for Dispute in Detail
			if (screen === "D" && approval === "D") {
				return oCheck;
			}
			//available
			if (bOverallApprove && bApprovalApprove) {
				return oCheck;
			}
			//not available
			oCheck.isAvailable = false;
			if (overall && bApprovalApprove) {
				oCheck.stateText = this._getOAStatusTextByCode(overall);
			}
			return oCheck;
		},
		_checkReleaseAvailableByStatus: function (screen, status) {
			var isReleaseAvailable = false;
			if (!status) {
				return isReleaseAvailable;
			}
			//not allowed status
			var aNotAlloweds = ["R", "D", "RE"]; //Released, Disputed, Rejected
			var aAlloweds = ["O", "A"]; //Open, Approved
			//Header
			if (screen === "H") {
				aNotAlloweds.push("RP", "RM"); //Released, Disputed, Rejected, Partially Released,Multi Released
				aAlloweds.push("AP"); //Open, Approved, PartiallyApproved
			}
			if (aNotAlloweds.includes(status)) {
				return isReleaseAvailable;
			}

			if (aAlloweds.includes(status)) {
				isReleaseAvailable = true; //allow cancel
				return isReleaseAvailable;
			}
			return isReleaseAvailable;
		},
		/**
		 * @param - code
		 * @return - status text
		 * */
		_getOAStatusTextByCode: function (code) {
				var statusText = "Not Allowed";
				var aStatuses = [{
					code: "A",
					text: "Approved"
				}, {
					code: "AP",
					text: "Partially Approved"
				}, {
					code: "D",
					text: "Disputed"
				}, {
					code: "O",
					text: "Open"
				}, {
					code: "R",
					text: "Released"
				}, {
					code: "RP",
					text: "Partially Released"
				}, {
					code: "RE",
					text: "Rejected"
				}, {
					code: "RM",
					text: "Multi Released"
				}];
				var statuses = aStatuses.filter(function (status) {
					return status["code"] === code;
				});
				if (statuses && statuses.length > 0) {
					statusText = statuses[0].text;
				}
				return statusText;

			} //end

	};
});