sap.ui.define([
	"com/erpis/shiperp/freightauditupload/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightauditupload.controller.App", {
		onInit: function () {
			var oViewModel = new JSONModel({});

			this.setModel(oViewModel, "appView");

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
		}
	});
});