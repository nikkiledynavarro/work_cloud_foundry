(function () {
	"use strict";
	/*global sap, jQuery */
	jQuery.sap.declare("com.erpis.shiperp.shippingdashboardhr7.controller.GlobalFilters");
	jQuery.sap.require("com.erpis.shiperp.shippingdashboardhr7.controller.BaseController");
	jQuery.sap.require("sap.ui.core.mvc.Controller");
	jQuery.sap.require("sap.m.MessageBox");
	jQuery.sap.require("sap.ui.model.json.JSONModel");
	/*
	Here you can put Controller code
	*/

	sap.ui.controller("com.erpis.shiperp.shippingdashboardhr7.controller.GlobalFilters", {
		onInit: function () {

		},

		onBeforeRendering: function () {
			// add logo
			var sRootPath = jQuery.sap.getModulePath("com.erpis.shiperp.shippingdashboardhr7");
			var sPath = sRootPath + "/img/shiperp_logo.png";
			this.byId("ovpMainPageTitle").getHeading().insertItem(new sap.m.Image({
				height: "1.5rem",
				src: sPath
			}).addStyleClass("sapUiSmallMarginEnd"), 0).setDisplayInline(true).setAlignItems("Center");

			// Get reference to SmartFilterBar
			var oSmartFilter = this.byId("ovpGlobalFilter");
			oSmartFilter.attachFilterChange(null, function () {
				if (oSmartFilter.getFilterData().CreatedOn) {
					oSmartFilter.setShowGoOnFB(true);
					
				} else {
					oSmartFilter.hideGoButton();
					return;
				}
			});
			oSmartFilter.attachInitialized(null, function () {
				var sDefaultVariantKey = oSmartFilter.getVariantManagement().getDefaultVariantKey();

				if (sDefaultVariantKey !== oSmartFilter.getVariantManagement().STANDARDVARIANTKEY) {
					return;
				}

				//Create JSON data to be defaulted
				var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyy-MM-dd"
				});
				var oToday = dateFormat.format(new Date());
				var oLastMonth = new Date();
				oLastMonth.setMonth(oLastMonth.getMonth() - 1);
				oLastMonth = dateFormat.format(new Date(oLastMonth));
				var oDefaultFilter = {
					CreatedOn: {
						ranges: [{
							exclude: false,
							keyField: "CreatedOn",
							operation: "BT",
							value1: oLastMonth,
							value2: oToday
						}]
					}
				};

				//Default the Global filter values
				oSmartFilter.setFilterData(oDefaultFilter);
			}, oSmartFilter);
		},

		getCustomFilters: function () {

		},
		getCustomAppStateDataExtension: function (oCustomData) {
			//the content of the custom field will be stored in the app state, so that it can be restored later, for example after a back navigation.
			//The developer has to ensure that the content of the field is stored in the object that is returned by this method.
			if (oCustomData) {

				// var oCustomField1 = this.oView.byId("ProductID");
				// var oCustomField2 = this.oView.byId("SalesOrderID");
				// if (oCustomField1) {
				//     oCustomData.ProductID = oCustomField1.getValue();
				// }
				// if (oCustomField2) {
				//     oCustomData.SalesOrderID = oCustomField2.getValue();
				// }
			}
		},
		restoreCustomAppStateDataExtension: function (oCustomData) {
			//in order to restore the content of the custom field in the filter bar, for example after a back navigation,
			//an object with the content is handed over to this method and the developer has to ensure that the content of the custom field is set accordingly
			//also, empty properties have to be set
			if (oCustomData) {

				// if (oCustomData.ProductID) {
				//     var oCustomField1 = this.oView.byId("ProductID");
				//     oCustomField1.setValue(oCustomData.ProductID);
				// }

				// if (oCustomData.SalesOrderID) {
				//     var oCustomField2 = this.oView.byId("SalesOrderID");
				//     oCustomField2.setValue(oCustomData.SalesOrderID);
				// }
			}

		}

	});
})();

// sap.ui.define([
// 	"com/erpis/shiperp/shippingdashboardhr7/controller/BaseController",
// 	"sap/ui/model/json/JSONModel"
// ], function (BaseController, JSONModel) {
// 	"use strict";

// 	return BaseController.extend("com.erpis.shiperp.shippingdashboardhr7.controller.GlobalFilters", {

// 	});

// });