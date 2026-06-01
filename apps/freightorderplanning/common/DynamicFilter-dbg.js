sap.ui.define([
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/freightorderplanning/common/Utils"
], function (Filter, FilterOperator, Utils) {
	"use strict";
	return {
		oController: null,
		/**
		 * Build dynamic filter array by input type
		 * @param: oDynamicFilter -- Filter component
		 * @param: oController - controller
		 * lastmodifyBy: Tim
		 * lastmodified: 2021/6/8
		 * */
		_buildFilterArray: function (oDynamicFilter, bAndCondition, oController) {
			this.oController = oController;
			var aAllFilter = [],
				aFilters = [];
			var aFilterItems = oDynamicFilter.getAllFilterItems();
			for (var i = 0; i < aFilterItems.length; i++) {
				var oGroupItem = aFilterItems[i];
				var oFilterControl = oGroupItem.getControl();
				var sControlNameSpace = oFilterControl.getMetadata().getName();
				var oFilterData = this._getFilterDataByControl(oFilterControl, sControlNameSpace);
				if (oFilterData.FilterValue !== null && oFilterData.FilterValue !== "" && oGroupItem.getName() !==
					"NoFilter" && oGroupItem.getVisibleInAdvancedArea() === true) {

					if (sControlNameSpace === "sap.m.DatePicker" || sControlNameSpace === "sap.m.DateRangeSelection") {
						//for date filter
						aFilters.push(new Filter(oGroupItem.getName(), oFilterData.FilterOpType, oFilterData.From, oFilterData.To));
					} else {
						//for normal filter
						aFilters.push(new Filter(oGroupItem.getName(), oFilterData.FilterOpType, oFilterData.FilterValue));
					}
				}
			} //end fr

			if (aFilters.length > 0) {
				aAllFilter = [new Filter(aFilters, bAndCondition)];
			}
			return aAllFilter;
		},
		_getFilterDataByControl: function (oCtrl, sCtrlNSpace) {
			var oFilterData = {
				FilterOpType: FilterOperator.EQ,
				FilterValue: "",
				FilterQueryType: "",
				From: "",
				To: "",
				ControlType: "Input"
			};
			switch (sCtrlNSpace) {
			case "sap.m.DatePicker":
				oFilterData.ControlType = "DatePicker";
				oFilterData.FilterQueryType = FilterOperator.BT;
				oFilterData.FilterOpType = FilterOperator.BT;
				oFilterData.FilterValue = oCtrl.getDateValue();
				if (oCtrl.getDateValue() !== null && oCtrl.getDateValue() !== "") {
					oFilterData.From = oCtrl.getDateValue().toISOString();
					var oDate = new Date(oCtrl.getDateValue());
					var oEndDate = this._toEndDay(oDate);
					oFilterData.To = oEndDate.toISOString();
				}
				break;
			case "sap.m.DateRangeSelection":
				oFilterData.ControlType = "DateRangeSelection";
				oFilterData.FilterQueryType = FilterOperator.BT;
				oFilterData.FilterOpType = FilterOperator.BT;
				oFilterData.FilterValue = oCtrl.getTo();
				if (oCtrl.getFrom() !== null && oCtrl.getTo() !== "") {
					oFilterData.From = Utils.convertDateTimeObjectToABAPString(oCtrl.getFrom(), "from");
					oFilterData.To = Utils.convertDateTimeObjectToABAPString(oCtrl.getTo(), "to");
				}
				break;
			case "sap.m.ComboBox":
				oFilterData.ControlType = "ComboBox";
				oFilterData.FilterOpType = FilterOperator.EQ;
				oFilterData.FilterValue = oCtrl.getSelectedKey();
				break;
			case "sap.m.MultiInput":
				oFilterData.ControlType = "MultiInput";
				oFilterData.FilterValue = oCtrl.getTokens();
				break;
			case "sap.m.Switch":
				oFilterData.ControlType = "Switch";
				oFilterData.FilterOpType = FilterOperator.EQ;
				oFilterData.FilterValue = oCtrl.getState();
				break;
			case "sap.m.CheckBox":
				oFilterData.ControlType = "CheckBox";
				oFilterData.FilterOpType = FilterOperator.EQ;
				oFilterData.FilterValue = oCtrl.getSelected();
				break;
			default:
				oFilterData.FilterValue = oCtrl.getValue().trim();
				break;
			}
			return oFilterData;
		},
		buildSingleFilter: function (sKey, oFilterOP, sValue) {
			var oBuildFilter = new Filter(sKey, oFilterOP, sValue);
			return oBuildFilter;
		},
		buildPlaningStatusFilter: function (sPlaningStatusKey) {
			if (sPlaningStatusKey === "UnPlanned") {
				return this.buildSingleFilter("PlanningStatus", FilterOperator.EQ, "01");
			}
			if (sPlaningStatusKey === "PartiallyPlanned") {
				return this.buildSingleFilter("PlanningStatus", FilterOperator.EQ, "02");
			}
			if (sPlaningStatusKey === "Planned") {
				return this.buildSingleFilter("PlanningStatus", FilterOperator.EQ, "03");
			}
			return null;

		},
		buildExcutionStatusFilter: function (sExecutionStatusKey) {
			if (sExecutionStatusKey === "NotStarted") {
				return this.buildSingleFilter("ExecutionStatus", FilterOperator.EQ, "02");
			}
			if (sExecutionStatusKey === "Loadded") {
				return this.buildSingleFilter("ExecutionStatus", FilterOperator.EQ, "07");
			}
			if (sExecutionStatusKey === "InExecution") {
				return this.buildSingleFilter("ExecutionStatus", FilterOperator.EQ, "03");
			}
			return null;
		},
		/**
		 * Convert time to end of day 23:59:59
		 * @param: oDate
		 * @return oDate with time end of day
		 * @last modified: TinhTD
		 * */
		_toEndDay: function (oDate) {
				var endOfDayDate = new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate(), 23, 59, 59);
				return endOfDayDate;
			} //end
	};
});