(function () {
	"use strict";
	/*global sap, jQuery */
	jQuery.sap.declare("com.erpis.shiperp.shippingdashboard.ext.OpenActionCard.Chart");
	jQuery.sap.require("jquery.sap.global");
	jQuery.sap.require("sap.ui.core.mvc.Controller");
	jQuery.sap.require("sap.ui.model.json.JSONModel");
	jQuery.sap.require("sap.viz.ui5.format.ChartFormatter");
	jQuery.sap.require("sap.viz.ui5.api.env.Format");

	/*
	Here you can put Controller code
	*/

	sap.ui.controller("com.erpis.shiperp.shippingdashboard.ext.OpenActionCard.Chart", {

		onInit: function () {
			var oList = this.getView().byId("idQuickLinkList");
			var oData = {
				list: [{
						Title: "Open SO",
						Icon: "sap-icon://create",
						SemanticObject: "SalesOrder",
						Action: "manage",
						Param: "Open"
					}, {
						Title: "Open Invoices",
						Icon: "sap-icon://decline",
						SemanticObject: "FreightAudit",
						Action: "manage",
						Param: "Open"
					}, {
						Title: "Open Disputes",
						Icon: "sap-icon://batch-payments",
						SemanticObject: "Dispute",
						Action: "manage",
						Param: "Open"
					}

				]
			};
			var dataModel = new sap.ui.model.json.JSONModel(oData);
			oList.setModel(dataModel);
		},

		onSalesAreaClose: function () {
			this.oSalesAreaDialog.close();
		},

		onNavToNewApp: function (oEvent) {
			var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
			var oData = oEvent.getSource().getBindingContext().getObject();
			var oParam = {};
			if (oData.Param) {
				oParam = {
					"Action": oData.Param
				};
			}
			var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
				target: {
					semanticObject: oData.SemanticObject,
					action: oData.Action
				},
				params: oParam
			})) || "";
			oCrossAppNavigator.toExternal({
				target: {
					shellHash: hash
				}
			});
		},

		onAfterRendering: function () {

		}

	});
})();