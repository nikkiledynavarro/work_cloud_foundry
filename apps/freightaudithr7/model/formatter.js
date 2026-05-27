sap.ui.define([
	"sap/ui/core/ValueState"
], function (ValueState) {
	"use strict";

	return {

		getTransparentLogoLink: function (sDummy) {
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.freightaudit.hr7");
			return sRootPath + "/image/shiperp_logo.png";
		},

		statusCount: function (sCnt) {
			return parseInt(sCnt, 10);
		},

		formatTotalCarrAmount: function (fBillAmt, fExAmt) {
			var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
				maxFractionDigits: 2,
				groupingEnabled: true,
				groupingSeparator: ",",
				decimalSeparator: "."
			});
			var fValue = parseFloat(fBillAmt - fExAmt);
			return oNumberFormat.format(fValue);
		},

		trafficLight: function (sMatchStatus) {
			if (sMatchStatus === "G") {
				return "sap-icon://status-positive";
			} else if (sMatchStatus === "Y1") {
				return "sap-icon://settings";
			} else if (sMatchStatus === "Y3") {
				return "sap-icon://compare-2";
			} else if (sMatchStatus === "R1") {
				return "sap-icon://settings";
			} else if (sMatchStatus === "R2") {
				return "sap-icon://past";
			} else if (sMatchStatus === "R3") {
				return "sap-icon://compare-2";
			} else if (sMatchStatus === "R") {
				return "sap-icon://error";
			} else {
				return "";
			}
		},

		trafficLightTooltip: function (sMatchStatus) {
			if (sMatchStatus === "G") {
				return "Matched";
			} else if (sMatchStatus === "Y1") {
				return "Charge code level unmatched";
			} else if (sMatchStatus === "Y3") {
				return "Exceed configured tolerance";
			} else if (sMatchStatus === "R1") {
				return "Charge code level unmatched";
			} else if (sMatchStatus === "R2") {
				return "Ship Date Delay";
			} else if (sMatchStatus === "R3") {
				return "Exceed configured tolerance";
			} else if (sMatchStatus === "R") {
				return "Error";
			} else {
				return "Error";
			}
		},

		trafficLightState: function (sMatchStatus) {
			if (sMatchStatus === "G") {
				return "Success";
			} else if (sMatchStatus === "Y1" || sMatchStatus === "Y3") {
				return "Warning";
			} else {
				return "Error";
			}
		},

		releaseHdrStatusText: function (sStatusCode) {
			switch (sStatusCode) {
			case "O":
				return "Open";
			case "R":
				return "Released";
			case "RP":
				return "Part. Rel";
			case "RM":
				return "Multi. Rel";
			case "RE":
				return "Rejected";
			default:
				return sStatusCode;
			}
		},

		releaseHdrStatusState: function (sStatusCode) {
			switch (sStatusCode) {
			case "R":
			case "RM":
				return ValueState.Success;
			case "RP":
			case "O":
				return ValueState.Warning;
			case "RE":
				return ValueState.Error;
			default:
				return ValueState.None;
			}
		},

		releaseHdrAStatusText: function (sStatusCode) {
			switch (sStatusCode) {
			case "A":
				return "Approved";
			case "AP":
				return "Part.Appr";
			case "D":
				return "Disputed";
			case "O":
				return "Open";
			case "R":
				return "Released";
			case "RE":
				return "Rejected";
			default:
				return sStatusCode;
			}
		},

		releaseHdrAStatusState: function (sStatusCode) {
			switch (sStatusCode) {
			case "A":
			case "R":
				return ValueState.Success;
			case "AP":
			case "O":
				return ValueState.Warning;
			case "D":
			case "RE":
				return ValueState.Error;
			default:
				return ValueState.None;
			}
		},

		releaseDtlStatusText: function (sStatusCode) {
			switch (sStatusCode) {
			case "A":
				return "Approved";
			case "D":
				return "Disputed";
			case "O":
				return "Open";
			case "R":
				return "Released";
			case "RE":
				return "Rejected";
			default:
				return sStatusCode;
			}
		},

		releaseDtlStatusState: function (sStatusCode) {
			switch (sStatusCode) {
			case "A":
			case "R":
				return ValueState.Success;
			case "O":
				return ValueState.Warning;
			case "D":
			case "RE":
				return ValueState.Error;
			default:
				return ValueState.None;
			}
		},

		formatButtonAPInvoiceNumberVisible: function (sOveralStatus) {
			if (sOveralStatus === "R" || sOveralStatus === "RP" || sOveralStatus === "RM") {
				return true;
			}
			return false;
		},

		formatTrackingApprovalStatusDesc: function (sStatus) {
			switch (sStatus) {
			case "A":
				return "Approved";
			case "R":
				return "Released";
			case "D":
				return "Disputed";
			case "RE":
				return "Rejected";
			default:
				return "Open";
			}
		},

		formatTrackingApprovalStatusIcon: function (sStatus) {
			switch (sStatus) {
			case "A":
				return "sap-icon://accept";
			case "R":
				return "sap-icon://accept";
			case "D":
				return "sap-icon://message-warning";
			case "RE":
				return "sap-icon://decline";
			default:
				return "sap-icon://batch-payments";
			}
		},

		formatTrackingApprovalStatusColor: function (sStatus) {
			switch (sStatus) {
			case "A":
				return "Success";
			case "R":
				return "Success";
			case "D":
				return "Warning";
			case "RE":
				return "Error";
			default:
				return "None";
			}
		},

		formatTrackingMatchPercentage: function (fInvTot, fSerpTot) {
			var oLocale = new sap.ui.core.Locale("en-US");
			var oFormatOptions = {
				minFractionDigits: 0,
				maxFractionDigits: 0
			};
			var oNumberFormat = sap.ui.core.format.NumberFormat.getIntegerInstance(oFormatOptions, oLocale);
			var fPercDiffRadial = 0;
			var fValueDiffRadial = Math.abs(fInvTot - fSerpTot);
			if (fInvTot <= fSerpTot && fInvTot > 0) {
				fPercDiffRadial = 1 - (fValueDiffRadial / fInvTot);
			} else if (fSerpTot <= fInvTot && fSerpTot > 0) {
				fPercDiffRadial = 1 - (fValueDiffRadial / fSerpTot);
			} else {
				fPercDiffRadial = 0;
			}
			fPercDiffRadial = Math.abs(fPercDiffRadial * 100);

			return oNumberFormat.parse(oNumberFormat.format(fPercDiffRadial));
		},

		formatTrackingAmountUpDownState: function (fInvTot, fSerpTot) {
			if (fInvTot === fSerpTot) {
				return "None";
			} else if (fInvTot > fSerpTot) {
				return "Error";
			} else {
				return "Success";
			}
		},

		formatTrackingAmountState: function (fInvTot, fSerpTot) {
			var oLocale = new sap.ui.core.Locale("en-US");
			var oFormatOptions = {
				minFractionDigits: 0,
				maxFractionDigits: 0
			};
			var oNumberFormat = sap.ui.core.format.NumberFormat.getIntegerInstance(oFormatOptions, oLocale);
			var fPercDiffRadial = 0;
			var fValueDiffRadial = Math.abs(fInvTot - fSerpTot);
			if (fInvTot <= fSerpTot && fInvTot > 0) {
				fPercDiffRadial = 1 - (fValueDiffRadial / fInvTot);
			} else if (fSerpTot <= fInvTot && fSerpTot > 0) {
				fPercDiffRadial = 1 - (fValueDiffRadial / fSerpTot);
			} else {
				fPercDiffRadial = 0;
			}
			fPercDiffRadial = Math.abs(fPercDiffRadial * 100);

			if (oNumberFormat.parse(oNumberFormat.format(fPercDiffRadial)) === 100) {
				return "Success";
			} else {
				return "Warning";
			}
		},

		formatAPInvoiceNumberOnInvoiceListView: function (sAPNumber) {
			if (!sAPNumber || sAPNumber.length < 10) {
				return "";
			} else {
				var sReturnValue = sAPNumber.substring(0, 10);
				return sReturnValue;
			}
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

		formatJavascriptTime: function (sTime) {
			if (!sTime || sTime.length !== 6 || sTime === "000000") {
				return "";
			} else {
				var sHour = sTime.substring(0, 2);
				var sMinute = sTime.substring(2, 4);
				var sSecond = sTime.substring(4, 6);
				return sHour + ":" + sMinute + ":" + sSecond;
			}
		}

	};

});