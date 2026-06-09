sap.ui.define([
	"com/erpis/shiperp/dispute/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.dispute.hd6.controller.App", {

		onInit: function () {
			var oViewModel = new JSONModel({});

			this.setModel(oViewModel, "appView");

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
		}
	});

});