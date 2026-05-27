sap.ui.define([
	"sap/ui/core/ValueState"
], function (ValueState) {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.freightorder");
			return sRootPath + "/image/shiperp_logo.png";
		},

		statusCount: function (sCnt) {
			return parseInt(sCnt, 10);
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
		},

		formatDate: function (sDateString) {
			if (!sDateString || sDateString === "00000000") {
				return "";
			} else if (sDateString.length >= 8) {
				var sYear = sDateString.substring(0, 4);
				var sMonth = sDateString.substring(4, 6);
				var sDate = sDateString.substring(6, 8);
				var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
					"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
				];
				var newDate = new Date(sYear, sMonth, sDate);
				return monthNames[newDate.getMonth()] + " " + newDate.getDate() + ", " +
					newDate.getFullYear();
			}
		},

		formatDateStringFull: function (sDateString) {
			//To be same with ABAP datum data type, sDateString should have format YYYYMMDDHHMMSS
			if (!sDateString || sDateString.length !== 14 || sDateString === "00000000000000") {
				if (sDateString && sDateString.length === 8) {
					var sYear1 = sDateString.substring(0, 4);
					var sMonth1 = sDateString.substring(4, 6);
					var sDate1 = sDateString.substring(6, 8);
					return sMonth1 + "/" + sDate1 + "/" + sYear1;
				} else {
					return "";
				}
			} else {
				var sYear = sDateString.substring(0, 4);
				var sMonth = sDateString.substring(4, 6);
				var sDate = sDateString.substring(6, 8);
				var sHour = sDateString.substring(8, 10);
				var sMinutes = sDateString.substring(10, 12);
				var sSeconds = sDateString.substring(12, 14);
				return sMonth + "/" + sDate + "/" + sYear + " " + sHour + ":" + sMinutes + ":" + sSeconds;
			}
		},

		formatJavascriptTime: function (sTime) {
			if (!sTime || sTime.length !== 6 || sTime === "000000") {
				return "";
			} else {
				var sHour = sTime.substring(0, 2);
				var sMinute = sTime.substring(2, 4);
				var sSecond = sTime.substring(4, 6);
				return sHour + ":" + sMinute + ":" + sSecond;
			}
		}, //Tim
		freightOrderPlanningStatusText: function (sStatusCode) {
			if (sStatusCode === "01" || sStatusCode === 1) {
				return "Not Planned";
			}
			if (sStatusCode === "02" || sStatusCode === 2) {
				return "Partially Planned";
			}
			if (sStatusCode === "03" || sStatusCode === 3) {
				return "Planned";
			}
			if (sStatusCode === "10" || sStatusCode === 10) {
				return "Not Ready for Planning";
			}
			if (sStatusCode === "11" || sStatusCode === 11) {
				return "Not Published";
			}
			return "N/A";
		},
		freightOrderPlanningStatusState: function (sStatusCode) {

			if (sStatusCode === "01" || sStatusCode === 1) {
				return ValueState.Error;
			}
			if (sStatusCode === "02" || sStatusCode === 2) {
				return ValueState.Warning;
			}
			if (sStatusCode === "03" || sStatusCode === 3) {
				return ValueState.Success;
			}
			return ValueState.None;

		},
		freightOrderExecutionStatusText: function (sStatusCode) {
			switch (sStatusCode) {
			case "01":
				return "Not Relevant";
			case "02":
				return "Not Started";
			case "03":
				return "In Execution";
			case "04":
				return "Excuted";
			case "05":
				return "Interrupted";
			case "06":
				return "Canceled";
			case "07":
				return "Ready for Transportation Execution";
			case "08":
				return "Not Ready for Transportation Execution";
			case "09":
				return "Loading in Process";
			case "10":
				return "Capacity Planning Finished";
			}
			return "N/A";
		},
		freightOrderExecutionStatusState: function (sStatusCode) {

			if (sStatusCode === "02" || sStatusCode === "06") {
				return ValueState.Error;
			}
			if (sStatusCode === "07") {
				return ValueState.Warning;
			}
			if (sStatusCode === "03" || sStatusCode === "04") {
				return ValueState.Success;
			}
			return ValueState.None;

		},
		formatAmountQty: function (fAmountQty) {
			if (fAmountQty) {
				return parseFloat(fAmountQty).toFixed(2).replace(/\.0+$/, "");
			}
			return fAmountQty;
		},
		formatComboboxTwoText: function (text1, text2) {
			if (text2 !== "") {
				if (text1 === text2) {
					return text1;
				}
				return text1 + " - " + text2;
			}
			return text1;

		},
		formatDangerousGoods: function (value) {
			if (value) {
				return true;
			}
			return false;
		},
		formatFOItemCategoryIcon: function (itemCat) {
			var sIcon = "sap-icon://car-rental";

			if (itemCat === "AVR") {
				sIcon = "sap-icon://vehicle-repair";

			}
			if (itemCat === "PRD") {
				sIcon = "sap-icon://product";
			}
			if (itemCat === "PKG") {
				sIcon = "sap-icon://supplier";

			}
			return sIcon;

		},
		formatFOItemCategoryState: function (itemCat) {
				var sState = "None";
				if (itemCat === "AVR") {

					sState = "Error";
				}
				if (itemCat === "PRD") {
					sState = "Success";
				}
				if (itemCat === "PKG") {
					sState = "Warning";
				}
				return sState;

			} //end

	};

});