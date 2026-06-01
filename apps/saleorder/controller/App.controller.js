sap.ui.define([
	"com/erpis/shiperp/salesorder/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.saleorder.controller.App", {

		onInit: function () {
			var oViewModel;

			oViewModel = new JSONModel({
				layout: "TwoColumnsMidExpanded",
				previousLayout: "",
				actionButtonsInfo: {
					midColumn: {
						fullScreen: false
					},
					endColumn: {
						fullScreen: false
					}
				}
			});
			this.setModel(oViewModel, "appView");

			// global model
			var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "YYYYMMdd"
			});
			var dateFormatted = dateFormat.format(new Date());

			this.setModel(new JSONModel({
				ShipSetSet: [],
				ShipSetSimulation: [],
				OrderItems: [{
					Item: "10",
					Material: "",
					Quantity: 0,
					UoM: "",
					Plant: "",
					ShippingPoint: "",
					Kordt: dateFormatted
				}]
			}), "global");
			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
		}

	});
});