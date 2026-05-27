sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("serp.so-shiperp-tab.controller.View1", {
		onInit: function () {
			const salesOrder = jQuery.sap.getUriParameters().get('salesorder');
			console.log(salesOrder);
			// let oView = this.getView();
			let oModel = this.getView().getModel();
			// var aFilter =[];
			// aFilter.push(new sap.ui.model.Filter("SalesOrder", sap.ui.model.FilterOperator.EQ, salesOrder));
			
			this.getView().bindElement("/A_SalesOrder('" + salesOrder + "')");
			// oModel.read("/A_SalesOrder('" + salesOrder + "')",
			// // "/A_SalesOrder('SalesOrder='" + salesOrder + "')"'
			// {
			// 	// filters: aFilter,
			// 	success: function(oData, response) {
			// 	  // use oData for a model and set it to view
			// 	  //oData.setModel(oModel);
			// 	  oView.bindElement(oModel);
			// 	  console.log(oData);
			// 	 },
			// 	 error: function(oError) { }
			// }
			// );
			
			console.log(oModel);
		}
	});
});