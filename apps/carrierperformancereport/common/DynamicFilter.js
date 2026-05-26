sap.ui.define([
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/hr7/carrierperformancereport/common/Utils",
], function (Filter, FilterOperator, Utils) {
	"use strict";
	return {
		oController: null,
		/**
		 * Build dynamic filter array by input type
		 * @param: oDynamicFilter -- Filter component
		 * @param: oController - controller
		 * lastmodifyBy: Micahel Ha
		 * lastmodified: 2024/26/04
		 * */
		_buildFilterArray: function (oDynamicFilter, bAndCondition, oController) {
			this.oController = oController;
			var aSlected = [];
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
					if (sControlNameSpace === "sap.m.MultiComboBox") {
						//for MultiComboBox filter
						if (oFilterData.FilterValue.length > 0) {
							oFilterData.FilterValue.forEach(function (item) {
								aSlected.push(new Filter(oGroupItem.getName(), oFilterData.FilterOpType, item));
							});
							var oFilter = new Filter({
								filters: aSlected,
								and: false
							});
							aFilters.push(oFilter);
						}
					} else if (sControlNameSpace === "sap.m.DatePicker" || sControlNameSpace === "sap.m.DateRangeSelection") {
						//for date filter
						aFilters.push(new Filter(oGroupItem.getName(), oFilterData.FilterOpType, oFilterData.From, oFilterData.To));
					} else if (sControlNameSpace === "sap.m.MultiInput") {
						//for multi input
						if (oFilterData.FilterValue.length > 0) {
							oFilterData.FilterValue.forEach(function (item) {
								aSlected.push(new Filter(oGroupItem.getName(), oFilterData.FilterOpType, item.getText()));
							});
							aFilters.push(new Filter({
								filters: aSlected,
								and: false
							}));
						}
					} else {
						//for normal filter
						aFilters.push(new Filter(oGroupItem.getName(), oFilterData.FilterOpType, oFilterData.FilterValue));
					}
					aSlected = [];
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
			case "sap.m.MultiComboBox":
				oFilterData.ControlType = "MultiComboBox";
				oFilterData.FilterOpType = FilterOperator.EQ;
				oFilterData.FilterValue = oCtrl.getSelectedKeys();
				break;
			default:
				oFilterData.FilterValue = oCtrl.getValue().trim();
				break;
			}
			return oFilterData;
		},
		/**
		 * Convert time to end of day 23:59:59
		 * @param: oDate
		 * @return oDate with time end of day
		 * @last modified: Michael Ha
		 * */
		_toEndDay: function (oDate) {
				var endOfDayDate = new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate(), 23, 59, 59);
				return endOfDayDate;
			} //end
	};
});