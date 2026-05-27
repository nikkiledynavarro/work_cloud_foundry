sap.ui.define([
	"com/erpis/shiperp/freightorder/controller/BaseController",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"com/erpis/shiperp/freightorder/model/formatter",
	"com/erpis/shiperp/freightorder/common/Utils",
	"com/erpis/shiperp/freightorder/common/HttpHelper",
	"sap/m/MessageBox"
], function (BaseController, Controller, JSONModel, Filter, formatter, Utils, HttpHelper, MessageBox) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightorder.controller.RequestRouting", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.freightorder.view.RequestRouting
		 */
		onInit: function (oEvent) {
			this.hideBusy();
			var oViewModel = new JSONModel();
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("requestRouting").attachPatternMatched(this._onObjectMatched, this);
		},
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.hideBusy();
			this.oVModel = this.getModel("local");
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sFreightOrderNumber = oEventArgs.FreightOrderNumber;
			this.getRouter().navTo("requestRouting", {
				FreightOrderNumber: this.sFreightOrderNumber,
				Station: this.sStation,
				Profile: this.sProfile
			});
			this._getInitData();
		},
		onNavBackToFreightOrderScreen: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("freightOrder", {
				Station: this.sStation,
				Profile: this.sProfile
			});
		},
		/*
		 * Internal function
		 */
		_getInitData: function (oEvent) {
			this.showBusy();
			// Selina 11/03/2022//
			var oFreightOrder = this.getModel("appView").getProperty("/SelectedFreightOrder");
			delete oFreightOrder.__metadata;
			var requestPickupDetailPayload = {
				Action: "RoutingDetails",
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightOrders: [oFreightOrder],
				Basic: {},
				Header: {},
				Partner: {},
				Contents: []
			};
			this.getModel().create("/FUFOQuerySet", requestPickupDetailPayload, {
				success: function (oData) {
					this.hideBusy();
					if (oData.Basic) {
						this.getModel("local").setProperty("/RequestRoutingBasic", oData.Basic);
					} else {
						this.getModel("local").setProperty("/RequestRoutingBasic", {});
					}
					if (oData.Header) {
						this.getModel("local").setProperty("/RequestRoutingHeader", oData.Header);
					} else {
						this.getModel("local").setProperty("/RequestRoutingHeader", {});
					}
					if (oData.Partner) {
						this.getModel("local").setProperty("/RequestRoutingPartner", oData.Partner);
					} else {
						this.getModel("local").setProperty("/RequestRoutingPartner", {});
					}
					if (oData.Contents) {
						this.getModel("local").setProperty("/RequestRoutingContents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/RequestRoutingContents", []);
					}
				}.bind(this),
				error: function (oError) {
					if (oError) {
						MessageBox.show(oError);
						this.hideBusy();
						return;
					}
				}.bind(this)
			});
		},
		onChangeEDI: function (oEvent) {
			var bEDI = oEvent.getSource().getSelected();
			this.getModel("local").setProperty("/RequestRoutingBasic/EDI", bEDI);
		},
		onSendEmailPressed: function () {
			this.showBusy();
			var requestPayload = this.generateRequestRoutingDataPayload();
			this.getModel().create("/FUFOQuerySet", requestPayload, {
				success: function (oData) {
					MessageBox.success("Send Email Successfully", {
						title: "Success"
					});
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					if (oError) {
						MessageBox.show(oError);
						this.hideBusy();
						return;
					}
				}.bind(this)
			});
		},
		generateRequestRoutingDataPayload: function () {
			var oRoutingBasic = this.getModel("local").getProperty("/RequestRoutingBasic");
			var oData = {
				Action: "RoutingSend",
				Messages: [],
				DataRoutingSend: [{
					freightorder: this.sFreightOrderNumber,
					Routing: {
						Email: oRoutingBasic.Email ? oRoutingBasic.Email : "",
						Telf1: oRoutingBasic.Phone ? oRoutingBasic.Phone : "",
						Telfx: oRoutingBasic.Fax ? oRoutingBasic.Fax : "",
						Url: oRoutingBasic.URL ? oRoutingBasic.URL : "",
						Edi: oRoutingBasic.EDI === 'X' ? true : false,
						Text: oRoutingBasic.Text ? oRoutingBasic.Text : "",
						TndrErpd: oRoutingBasic.PickupDate ? Utils.convertDatetoYYYYMMDDHHMMSSFormat2(oRoutingBasic.PickupDate) : ""
					}
				}]
			};
			if (oData.DataRoutingSend[0].Routing.TndrErpd === "") {
				delete oData.DataRoutingSend[0].Routing.TndrErpd;
			}
			return oData;
		}
	});
});