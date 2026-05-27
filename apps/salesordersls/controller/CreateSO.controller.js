/*global history */
sap.ui.define([
	"com/erpis/shiperp/sls/salesordersls/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter",
	"sap/ui/model/Sorter",
	"sap/ui/model/FilterOperator",
	"sap/m/GroupHeaderListItem",
	"sap/ui/Device",
	"com/erpis/shiperp/sls/salesordersls/model/formatter",
	"com/erpis/shiperp/sls/salesordersls/common/Utils",
	"sap/m/MessageBox",
	"sap/base/Log"
], function (BaseController, JSONModel, History, Filter, Sorter, FilterOperator, GroupHeaderListItem, Device, formatter, Utils,
	MessageBox, Log) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.sls.salesordersls.controller.CreateSO", {
		oLog: null,
		formatter: formatter,
		bSoldToPressed: false,
		sSalesDocType: "",
		sSalesOrg: "",
		sDistChannel: "",
		sDivision: "",
		aTvta: [],
		sCurrentCarrier: "",
		//Default OrderItem
		oDefaultOrderItemDetail: {
			UoM: "",
			Plant: "",
			ShippingPoint: ""
		},
		oShipsetTab: null,

		oBundle: null, // i18n bundle class
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oLog = Log.getLogger("com.erpis.shiperp.sls.salesordersls.controller.CreateSO");
			this.oBundle = this.getResourceBundle();
			var oViewModel = new JSONModel({
				ShippingPoints: []
			});
			this.setModel(oViewModel, "local");

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
			this.oShipsetTab = this.byId("idSimulateShipsetTab");
			this.getRouter().getRoute("createSO").attachPatternMatched(this._onObjectMatched, this);

		},

		_onObjectMatched: function (oEvent) {
			this.sSalesDocType = oEvent.getParameter("arguments").SalesDocType;
			this.sSalesOrg = oEvent.getParameter("arguments").SalesOrg;
			this.sDistChannel = oEvent.getParameter("arguments").DistChannel;
			this.sDivision = oEvent.getParameter("arguments").Division;

			this.byId("title").setText("Simulate Sales Order (" + this.sSalesOrg + "/" + this.sDistChannel + "/" + this.sDivision + ")");

			// set the layout property of FCL control to show two columns
			this.getModel("appView").setProperty("/layout", "OneColumn");

			// Reset screen fields
			this.byId("txtSoldTo").setValue("");
			this.byId("txtShipTo").setValue("");
			this.byId("dpDelDate").setValue("");
			var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "YYYYMMdd"
			});
			var dateFormatted = dateFormat.format(new Date());
			this.byId("dpDelDate").setValue(dateFormatted);
			var aOrderItems = [{
				Item: "10",
				Material: "",
				Quantity: "0",
				UoM: "",
				Plant: "",
				ShippingPoint: "",
				DeliveryDate: dateFormatted
			}];
			this.getModel("global").setProperty("/OrderItems", aOrderItems);
			this.getModel("global").setProperty("/ShipSetSimulation", []);
			this.sCurrentCarrier = this.byId("idCarrierComboSim").getSelectedKey();
			this.byId("idServiceComboSim").getBinding("items").filter(new Filter("Scac", "EQ", this.sCurrentCarrier));
			this.getReferenceDistChannel();
		},

		getReferenceDistChannel: function () {
			this.showBusy();
			this.getModel().callFunction("/GetTvtaData", {
				method: "GET",
				urlParameters: {
					SalesOrg: this.sSalesOrg,
					DistChannel: this.sDistChannel
				},
				success: function (oData) {
					if (oData.results.length > 0) {
						oData.results.forEach(function (item) {
							this.aTvta.push(item);
						}.bind(this));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onSoldToValueHelp: function () {
			this.bSoldToPressed = true;
			this.oCustomerDlg = Utils.getFragment("", "CustomerDialog", this);

			var aReferenceDistChannelFilter = [new Filter({
				path: "DistChannel",
				operator: FilterOperator.EQ,
				value1: this.sDistChannel
			})];
			var aReferenceDivisionFilter = [new Filter("Division", sap.ui.model.FilterOperator.EQ, this.sDivision)];

			this.aTvta.forEach(function (item) {
				aReferenceDistChannelFilter.push(new Filter({
					path: "DistChannel",
					operator: FilterOperator.EQ,
					value1: item.RefDistChannel
				}));
				aReferenceDivisionFilter.push(new Filter({
					path: "Division",
					operator: FilterOperator.EQ,
					value1: item.RefDivision.toString()
				}));

			}.bind(this));

			var aFilters = [
				new Filter({
					filters: [
						new Filter("SalesOrg", sap.ui.model.FilterOperator.EQ, this.sSalesOrg),
						new Filter({
							filters: aReferenceDistChannelFilter,
							and: false
						}),
						new Filter({
							filters: aReferenceDivisionFilter,
							and: false
						})
					],
					and: true
				})
			];
			this.byId("sltCustomer").getBinding("items").filter(aFilters);
			this.oCustomerDlg.open();
		},

		onShipToValueHelp: function () {
			this.bSoldToPressed = false;
			this.oCustomerDlg = Utils.getFragment("", "CustomerDialog", this);
			var aReferenceDistChannelFilter = [new Filter({
				path: "DistChannel",
				operator: FilterOperator.EQ,
				value1: this.sDistChannel
			})];
			var aReferenceDivisionFilter = [new Filter("Division", sap.ui.model.FilterOperator.EQ, this.sDivision)];

			this.aTvta.forEach(function (item) {
				aReferenceDistChannelFilter.push(new Filter({
					path: "DistChannel",
					operator: FilterOperator.EQ,
					value1: item.RefDistChannel
				}));
				aReferenceDivisionFilter.push(new Filter({
					path: "Division",
					operator: FilterOperator.EQ,
					value1: item.RefDivision.toString()
				}));

			}.bind(this));

			var aFilters = [
				new Filter({
					filters: [
						new Filter("SalesOrg", sap.ui.model.FilterOperator.EQ, this.sSalesOrg),
						new Filter({
							filters: aReferenceDistChannelFilter,
							and: false
						}),
						new Filter({
							filters: aReferenceDivisionFilter,
							and: false
						})
					],
					and: true
				})
			];
			this.byId("sltCustomer").getBinding("items").filter(aFilters);
			this.oCustomerDlg.open();
		},

		onCustomerValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oAllFilter = new Filter([
				new Filter("Customer", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Name1", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			var aFilters = [
				new Filter("SalesOrg", sap.ui.model.FilterOperator.EQ, this.sSalesOrg),
				new Filter("DistChannel", sap.ui.model.FilterOperator.EQ, this.sDistChannel),
				new Filter("Division", sap.ui.model.FilterOperator.EQ, this.sDivision),
				oAllFilter
			];

			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},

		onCustomerConfirm: function (oEvent) {
			if (this.bSoldToPressed) {
				this.byId("txtSoldTo").setValue(oEvent.getParameter("selectedItem").getBindingContext().getObject().Customer);
				this.byId("txtShipTo").setValue(oEvent.getParameter("selectedItem").getBindingContext().getObject().Customer);
			} else {
				this.byId("txtShipTo").setValue(oEvent.getParameter("selectedItem").getBindingContext().getObject().Customer);
			}
		},

		onMaterialValueHelp: function (oEvent) {
			this.oMaterialControl = oEvent.getSource();
			this.oMaterialDlg = Utils.getFragment("", "MaterialDialog", this);
			var aReferenceDistChannelFilter = [new Filter({
				path: "DistChannel",
				operator: FilterOperator.EQ,
				value1: this.sDistChannel
			})];
			this.aTvta.forEach(function (item) {
				aReferenceDistChannelFilter.push(new Filter({
					path: "DistChannel",
					operator: FilterOperator.EQ,
					value1: item.RefDistChannel
				}));
			}.bind(this));
			var aFilters = [
				new Filter({
					filters: [
						new Filter({
							path: "SalesOrg",
							operator: FilterOperator.EQ,
							value1: this.sSalesOrg
						}),
						new Filter({
							filters: aReferenceDistChannelFilter,
							and: false
						})
					],
					and: true
				})
			];
			this.byId("sltMaterial").getBinding("items").filter(aFilters);
			this.oMaterialDlg.open();
		},

		onMaterialValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oAllFilter = new Filter([
				new Filter("Material", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Description", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			var aFilters = [
				new Filter("SalesOrg", sap.ui.model.FilterOperator.EQ, this.sSalesOrg),
				new Filter("DistChannel", sap.ui.model.FilterOperator.EQ, this.sDistChannel),
				oAllFilter
			];

			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},

		onMaterialConfirm: function (oEvent) {
			var sCustomer = this.byId("txtSoldTo").getValue();
			var sMaterial = oEvent.getParameter("selectedItem").getBindingContext().getObject().Material;
			var sPath = this.oMaterialControl.getBindingContext("global").getPath();
			var oObject = this.oMaterialControl.getBindingContext("global").getObject();
			oObject.Material = sMaterial;
			this.getModel("global").setProperty(sPath, oObject);

			this._getDefaultSOItemValue(sMaterial, "", sCustomer, sPath);
		},
		onMaterialChange: function (oEvent) {
			var oControl = oEvent.getSource();
			var sCustomer = this.byId("txtSoldTo").getValue();
			var sMaterial = oEvent.getParameter("value");
			var sPath = oControl.getBindingContext("global").getPath();
			var oObject = oControl.getBindingContext("global").getObject();
			oObject.Material = sMaterial;
			this.getModel("global").setProperty(sPath, oObject);

			this._getDefaultSOItemValue(sMaterial, "", sCustomer, sPath);
		},

		onUoMValueHelp: function (oEvent) {
			this.oUoMControl = oEvent.getSource();
			var sMaterial = oEvent.getSource().getBindingContext("global").getObject().Material;
			if (sMaterial === "") {
				MessageBox.error("Please select a Material first!");
				return;
			}
			this.oUoMDlg = Utils.getFragment("", "UoMDialog", this);
			var aFilters = [
				new Filter("Material", sap.ui.model.FilterOperator.EQ, sMaterial)
			];

			this.byId("sltUoM").getBinding("items").filter(aFilters);
			this.oUoMDlg.open();
		},

		onUoMValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var sMaterial = this.oUoMControl.getBindingContext("global").getObject().Material;
			var oAllFilter = new Filter([
				new Filter("UoM", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Description", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			var aFilters = [
				new Filter("Material", sap.ui.model.FilterOperator.EQ, sMaterial),
				oAllFilter
			];
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},

		onUoMConfirm: function (oEvent) {
			var sUoM = oEvent.getParameter("selectedItem").getBindingContext().getObject().UoM;
			var sPath = this.oUoMControl.getBindingContext("global").getPath();
			var oObject = this.oUoMControl.getBindingContext("global").getObject();
			oObject.UoM = sUoM;
			this.getModel("global").setProperty(sPath, oObject);
		},

		onPlantValueHelp: function (oEvent) {
			this.oPlantControl = oEvent.getSource();
			//Tim Updated 13/12/2021
			var oCurrRow = oEvent.getSource().getBindingContext("global").getObject();
			var sMaterial = oCurrRow.Material;
			var sSoldTo = this.byId("txtSoldTo").getValue();
			if (sMaterial === "" || sSoldTo === "") {
				MessageBox.error("Please select a Material/Sold To first!");
				return;
			}
			this.oPlantDlg = Utils.getFragment("", "PlantDialog", this);

			//Tim Updated 13/12/2021 Axo 4851
			var aFilters = [
				new Filter("Material", sap.ui.model.FilterOperator.EQ, sMaterial),
				new Filter("SalesOrg", sap.ui.model.FilterOperator.EQ, this.sSalesOrg),
				new Filter("Customer", sap.ui.model.FilterOperator.EQ, sSoldTo) //Axo 4851
			];
			// (+) Plant filter update
			var oDCFilter1 = [
				new Filter("DistChannel1", sap.ui.model.FilterOperator.EQ, this.sDistChannel),
				new Filter("Division1", sap.ui.model.FilterOperator.EQ, this.sDivision)
			];
			var oDCFilter2 = [
				new Filter("DistChannel2", sap.ui.model.FilterOperator.EQ, this.sDistChannel),
				new Filter("Division2", sap.ui.model.FilterOperator.EQ, this.sDivision)
			];
			var aDCFilters = [];
			aDCFilters.push(new sap.ui.model.Filter(oDCFilter1, false));
			aDCFilters.push(new sap.ui.model.Filter(oDCFilter2, false));

			aFilters.push(new sap.ui.model.Filter(aDCFilters, true));
			this.byId("sltPlant").getBinding("items").filter(aFilters);
			this.oPlantDlg.open();
		},

		onPlantValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var sMaterial = this.oPlantControl.getBindingContext("global").getObject().Material;
			var sSoldTo = this.byId("txtSoldTo").getValue();
			var oAllFilter = new Filter([
				new Filter("Plant", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Description", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			var aFilters = [
				new Filter("Material", sap.ui.model.FilterOperator.EQ, sMaterial),
				new Filter("SalesOrg", sap.ui.model.FilterOperator.EQ, this.sSalesOrg),
				new Filter("Customer", sap.ui.model.FilterOperator.EQ, sSoldTo), //Axo 4851
				oAllFilter
			];
			// (+) Plant filter update
			var oDCFilter1 = [
				new Filter("DistChannel1", sap.ui.model.FilterOperator.EQ, this.sDistChannel),
				new Filter("Division1", sap.ui.model.FilterOperator.EQ, this.sDivision)
			];
			var oDCFilter2 = [
				new Filter("DistChannel2", sap.ui.model.FilterOperator.EQ, this.sDistChannel),
				new Filter("Division2", sap.ui.model.FilterOperator.EQ, this.sDivision)
			];
			var aDCFilters = [];
			aDCFilters.push(new sap.ui.model.Filter(oDCFilter1, false));
			aDCFilters.push(new sap.ui.model.Filter(oDCFilter2, false));

			aFilters.push(new sap.ui.model.Filter(aDCFilters, true));
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},

		onPlantConfirm: function (oEvent) {
			var sMaterial = oEvent.getParameter("selectedItem").getBindingContext().getObject().Material;
			var sPlant = oEvent.getParameter("selectedItem").getBindingContext().getObject().Plant;
			var sPath = this.oPlantControl.getBindingContext("global").getPath();
			var oObject = this.oPlantControl.getBindingContext("global").getObject();
			oObject.Plant = sPlant;
			this.getModel("global").setProperty(sPath, oObject);

			if (sMaterial) {
				this._getDefaultSOItemValue(sMaterial, sPlant, "", sPath);
			}
		},

		onShippingPointValueHelp: function (oEvent) {
			this.oShippingPointControl = oEvent.getSource();
			var sMaterial = oEvent.getSource().getBindingContext("global").getObject().Material;
			var sPlant = oEvent.getSource().getBindingContext("global").getObject().Plant;
			var sSoldTo = this.byId("txtSoldTo").getValue();
			if (sMaterial === "" || sPlant === "" || sSoldTo === "") {
				MessageBox.error("Please select a Material/Plant/Sold To first!");
				return;
			}
			this.showBusy();
			this.oShippingPointDlg = Utils.getFragment("", "ShippingPointDialog", this);
			this.getModel().callFunction("/GetShippingPointList", {
				method: "GET",
				urlParameters: {
					Material: sMaterial,
					Plant: sPlant,
					SalesOrg: this.sSalesOrg,
					DistChannel: this.sDistChannel,
					Division: this.sDivision,
					Customer: sSoldTo,
					OrderType: this.sSalesDocType
				},
				success: function (oData) {
					this.oShippingPointDlg.open();
					this.getModel("local").setProperty("/ShippingPoints", oData.results);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onShippingPointValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oAllFilter = new Filter([
				new Filter("ShippingPoint", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Description", sap.ui.model.FilterOperator.Contains, sValue)
			], false);

			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oAllFilter]);
		},

		onShippingPointConfirm: function (oEvent) {
			var sShippingPoint = oEvent.getParameter("selectedItem").getBindingContext("local").getObject().ShippingPoint;
			var sPath = this.oShippingPointControl.getBindingContext("global").getPath();
			var oObject = this.oShippingPointControl.getBindingContext("global").getObject();
			oObject.ShippingPoint = sShippingPoint;
			this.getModel("global").setProperty(sPath, oObject);
		},

		onAddItem: function () {
			var aOrderItems = this.getModel("global").getProperty("/OrderItems");
			var sNextItem = "";
			if (aOrderItems.length > 0) {
				sNextItem = (parseInt(aOrderItems[aOrderItems.length - 1].Item, 10) + 10) + "";
			} else {
				sNextItem = "10";
			}
			var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "YYYYMMdd"
			});
			var dateFormatted = dateFormat.format(new Date());
			var oItem = {
				Item: sNextItem,
				Material: "",
				Quantity: 0,
				UoM: "",
				Plant: "",
				ShippingPoint: "",
				DeliveryDate: dateFormatted
			};
			aOrderItems.push(oItem);
			this.getModel("global").setProperty("/OrderItems", aOrderItems);
		},

		onDeleteItem: function (oEvent) {
			var oItem = oEvent.getSource().getBindingContext("global").getObject();
			var aOrderItems = this.getModel("global").getProperty("/OrderItems");
			for (var i = 0; i < aOrderItems.length; i++) {
				if (aOrderItems[i].Item === oItem.Item) {
					aOrderItems.splice(i, 1);
					break;
				}
			}
			this.getModel("global").setProperty("/OrderItems", aOrderItems);
		},

		onSimulateSingleRate: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getRates(oObject, "S");
		},

		onSimulateRateShop: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getRates(oObject, "R");
		},

		onSimulateOptimization: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getRates(oObject, "O");
		},

		onSimulate: function (oEvent) {
			var sSoldTo = this.byId("txtSoldTo").getValue();
			var sShipTo = this.byId("txtShipTo").getValue();
			var sDelDate = this.byId("dpDelDate").getValue();
			if (!sSoldTo || !sShipTo || !sDelDate) {
				MessageBox.error("Please fill out the order details to continue!");
				return;
			}
			var oOrderDetail = {
				DocType: this.sSalesDocType,
				SalesOrg: this.sSalesOrg,
				DistrChannel: this.sDistChannel,
				Division: this.sDivision,
				RequestedDate: sDelDate,
				SoldToParty: sSoldTo,
				ShipToParty: sShipTo
			};
			var aOderItems = this.getModel("global").getProperty("/OrderItems");
			this._simulate(oOrderDetail, aOderItems);
		},

		onCloseRateDialog: function (oEvent) {
			this.oRateDialog.close();
		},

		onRateSelected: function () {
			if (this.byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			// Call Carrier/Service determination. If success, update the global model
			var oRate = this.byId("tableRates").getSelectedItem().getBindingContext("global").getObject();
			var oShipset = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			this._setRate(oShipset, oRate);
		},

		onShowRatePricingDetail: function () {
			var oRateTab = this.getView().byId("tableRates");
			if (oRateTab.getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			this.oRatePricingDialog = Utils.getFragment(null, "RatePricingsDialog", this);
			var oObject = oRateTab.getSelectedItem().getBindingContext("global").getObject();
			var oRatePricingTemplate = sap.ui.xmlfragment("com.erpis.shiperp.sls.salesordersls.fragment.RatePricingColumnListItem", this);
			var oBindingInfo = {
				path: "global>/PricProcSet",
				template: oRatePricingTemplate,
				filters: [
					new Filter("Carrier", "EQ", oObject.Code),
					new Filter("Service", "EQ", oObject.Service)
				]
			};
			this.byId("tblRatePricingList").bindItems(oBindingInfo);
			this.oRatePricingDialog.open();
		},

		onShowRateAnalysisDetail: function () {
			var oRateTab = this.getView().byId("tableRates");
			if (oRateTab.getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			this.oRateAnalysisDialog = Utils.getFragment(null, "RateAnalysisDialog", this);
			this.oRateAnalysisDialog.open();
		},

		onShowRateDetail: function () {
			if (this.byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}

			this.oRateDetailDialog = Utils.getFragment(null, "RateDetailsDialog", this);

			var oObject = this.byId("tableRates").getSelectedItem().getBindingContext("global").getObject();
			var oRateDetailTemplate = sap.ui.xmlfragment("com.erpis.shiperp.sls.salesordersls.fragment.RateDetailColumnListItem", this);
			var oBindingInfo = {
				path: "global>/RateDetailsSet",
				template: oRateDetailTemplate,
				filters: [
					new Filter("Carrier", "EQ", oObject.Code),
					new Filter("Service", "EQ", oObject.Service)
				]
			};
			this.byId("tblRateDetailList").bindItems(oBindingInfo);
			this.oRateDetailDialog.open();
		},

		onCarrierSelectionChange: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select one shipset to continues!");
				oEvent.getSource().setSelectedItem(null);
				return;
			}

			var sCarrier = "";
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				sCarrier = oSelectedItem.getKey();
			}
			this.sCurrentCarrier = sCarrier;
			this._changeCarrier(sCarrier);
		},

		onChangeService: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select one shipset to continues!");
				oEvent.getSource().clearSelection();
				oEvent.getSource().setValue("");

				return;
			}
			this._getServiceDeterminationSimulation();
		},

		onCloseRatePricingDialog: function () {
			this.oRatePricingDialog.close();
		},

		onCloseRateAnalysisDetail: function () {
			this.oRateAnalysisDialog.close();
		},

		onCloseRateDetailDialog: function () {
			this.oRateDetailDialog.close();
		},

		onMessagesFilter: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			var oAllFilter = new Filter([
				new Filter("Text1", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Text2", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Text3", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			this.byId("tabHdr").getBinding("items").filter([oAllFilter]);
		},

		onAfterRateAnalysisOpen: function () {
			var oObject = this.byId("tableRates").getSelectedItem().getBindingContext("global").getObject();
			var aAnalysis = this.getModel("global").getProperty("/RateAnalysisSet");
			try {
				var aOutput = [];
				var bFound = false;
				// Filter the rate analysis where carrier and service equal the selected rate entry
				for (var i = 0; i < aAnalysis.length; i++) {
					if (aAnalysis[i].Carrier === "" && aAnalysis[i].Service === "") {
						for (var j = 0; j < aOutput.length; j++) {
							if (aOutput[j].NodeId === aAnalysis[i].NodeId) {
								bFound = true;
								break;
							}
						}
						if (!bFound) {
							aOutput.push(aAnalysis[i]);
						} else {
							bFound = false;
						}
					}
					if (aAnalysis[i].Carrier === oObject.Code && aAnalysis[i].Service === oObject.Service) {
						aOutput.push(aAnalysis[i]);
					}
				}
				this.getModel("global").setProperty("/RateAnalysis", this.treeify(aOutput, "NodeId", "ParentId"));
			} catch (exc) {
				this.oLog.error(exc);
				this.getModel("global").setProperty("/RateAnalysis", []);
			}
		},

		onChangeRateAnalysisLine: function (oEvent) {
			if (oEvent.getParameter("rowContext")) {
				var oObject = oEvent.getParameter("rowContext").getObject();
				var oTitle = this.byId("txtTabDesc");
				if (oObject.Tabname === "" && oObject.Tabkey === "") {
					return;
				}
				oTitle.setText(oObject.NodeDesc);
				this.showBusy();
				this.analyRequest = this.getModel().callFunction("/GetConditionValue", {
					method: "GET",
					urlParameters: {
						TabName: oObject.Tabname,
						TabKey: oObject.Tabkey,
						Sdata: oObject.Sdata
					},
					success: function (oData) {
						this.getModel("global").setProperty("/RateMessagesToFields", oData.results);
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.getModel("global").setProperty("/RateMessagesToFields", []);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		onAnalysisDataFound: function (oEvent) {
			var iCount = oEvent.getSource().getItems().length;
			oEvent.getSource().setVisible(iCount !== 0);
		},

		onShipsetItemPress: function (oEvent) {
			this.oShipsetItemDialog = Utils.getFragment(null, "ShipsetItemDialog", this);
			this.oShipsetItemDialog.bindElement({
				path: "global>" + oEvent.getSource().getBindingContext("global").getPath()
			});
			this.oShipsetItemDialog.open();
		},

		onCloseShipSetItemDialog: function () {
			this.oShipsetItemDialog.close();
		},

		onShipsetSimulationChange: function (oEvent) {
			var oObject = oEvent.getParameter("listItems")[0].getBindingContext("global").getObject();
			this.sCurrentCarrier = oObject.Carrier;
			this.byId("idCarrierComboSim").setSelectedKey(oObject.Carrier);
			this.byId("idServiceComboSim").setSelectedKey(oObject.Service);
			this.byId("idServiceComboSim").getBinding("items").filter(new Filter("Scac", "EQ", oObject.Carrier));
		},

		onSimulatePackProposal: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getPackProposalSimulation(oObject);
		},

		onProposalSimulationDlgCancel: function (oEvent) {
			this.oPackProposalDialog.close();
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_getPackProposalSimulation: function (oObject) {
			var oRequestData = this._generateGetPackProposalSimulationUsecase(oObject);
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					// Build upper table json node for display
					if (!oData.ShipSetSet.results[0].PackingProposalSet) {
						oData.ShipSetSet.results[0].PackingProposalSet = {
							results: []
						};
					}
					var aResults = jQuery.extend(true, [], oData.ShipSetSet.results[0].PackingProposalSet.results);
					var aOutput = this.treeify(aResults, "NodeId", "ParentId");
					// This json node is used to bind the tree table
					this.getModel("global").setProperty("/PackingOverviewSimulationList", aOutput);
					this.oPackProposalDialog = Utils.getFragment(null, "PackingProposalSimulationDialog", this);
					this.oPackProposalDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateGetPackProposalSimulationUsecase: function (oObject) {
			oObject.PackingProposalSet = [];
			var oData = {
				Vbeln: this.sSalesOrg,
				Action: "PackProposalSimulation",
				ShipSetSet: [oObject]
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},
		_changeCarrier: function (sCarrier) {
			var oServiceControl = this.byId("idServiceComboSim");
			oServiceControl.getBinding("items").filter(new Filter("Scac", "EQ", sCarrier));
			this._getCarrierDeterminationSimulation();
		},

		_getCarrierDeterminationSimulation: function () {
			var oRequestData = this._generateCarrierDeterminationUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					if (oData.ShipSetSet) {
						var oShipset = oData.ShipSetSet.results[0];
						if (!oShipset.ShipSetItemSet) {
							oShipset.ShipSetItemSet = [];
						}
						var sPath = this.oShipsetTab.getSelectedItem().getBindingContext("global").getPath();
						this.getModel("global").setProperty(sPath, oShipset);
						this.byId("idServiceComboSim").setSelectedKey(oShipset.Service);
					}

					this._overwriteCommonSOFlatStructure(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCarrierDeterminationUsecase: function () {
			var oObject = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			oObject.Carrier = this.sCurrentCarrier;
			var oData = {
				Vbeln: this.sSalesOrg,
				ShipSetSet: [oObject],
				Action: "CarrierDeterminationSimulation"
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_getServiceDeterminationSimulation: function () {
			var oRequestData = this._generateServiceDeterminationUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					if (oData.ShipSetSet) {
						var oShipset = oData.ShipSetSet.results[0];
						if (!oShipset.ShipSetItemSet) {
							oShipset.ShipSetItemSet = [];
						}
						var sPath = this.oShipsetTab.getSelectedItem().getBindingContext("global").getPath();
						this.getModel("global").setProperty(sPath, oShipset);
					}
					this._overwriteCommonSOFlatStructure(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateServiceDeterminationUsecase: function () {
			var oObject = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			var oServiceControl = this.byId("idServiceComboSim");
			oObject.Carrier = this.sCurrentCarrier;
			oObject.Service = oServiceControl.getSelectedItem().getKey();
			var oData = {
				Vbeln: this.sSalesOrg,
				ShipSetSet: [oObject],
				Action: "ServiceDeterminationSimulation"
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_updateShipsetDetermination: function (oData) {
			if (oData.ShipSetSet) {
				if (oData.ShipSetSet.results.length > 0) {
					// Overwrite original Packing proposal active flag
					this._updateOriginalPackingProposalActive(oData);

					if (oData.ShipSetSet.results.length === 1) {
						var aOriginShipsetItem = this.getView().getBindingContext("global").getObject().ShipSetItemSet;
						var aOriginPackProposal = this.getView().getBindingContext("global").getObject().PackingProposalSet;
						var aOriginMoreOption = this.getView().getBindingContext("global").getObject().MoreOptionSet;
						var oShipset = oData.ShipSetSet.results[0];
						oShipset.ShipSetItemSet = aOriginShipsetItem;
						oShipset.PackingProposalSet = aOriginPackProposal;
						oShipset.MoreOptionSet = aOriginMoreOption;

						if (oShipset.Billoption === "3PRTY" || oShipset.Billoption === "COLL") {
							this.sOriginal3Acc = oShipset.Tpacct;
							this.sOriginal3Zip = oShipset.Tpzip;
							this.sOriginal3Cnt = oShipset.Tpctry;
						} else if (oShipset.Billoption === "PPAID") {
							this.bOriginalPrepaid = oShipset.Ppaidadd;
						}

						var sPath = this.getView().getBindingContext("global").getPath();
						this.getModel("global").setProperty(sPath, oShipset);

						this.byId("idServiceComboSim").getBinding("items").filter(new Filter("Scac", "EQ", oShipset.Carrier));
					} else {
						var aShipset = this.getModel("global").getProperty("/ShipSetSet");
						for (var i = 0; i < oData.ShipSetSet.results.length; i++) {
							for (var j = 0; j < aShipset.length; j++) {
								if (aShipset[j].Counter === oData.ShipSetSet.results[i].Counter) {
									var aShipsetItem = aShipset[j].ShipSetItemSet;
									var aPackProposal = aShipset[j].PackingProposalSet;
									var aMoreOption = aShipset[j].MoreOptionSet;
									aShipset[j] = oData.ShipSetSet.results[i];
									aShipset[j].ShipSetItemSet = aShipsetItem;
									aShipset[j].PackingProposalSet = aPackProposal;
									aShipset[j].MoreOptionSet = aMoreOption;
									break;
								}
							}
						}
						this.getModel("global").setProperty("/ShipSetSet", aShipset);
						var sCarrier = this.getView().getBindingContext("global").getObject().Carrier;
						this.byId("idServiceComboSim").getBinding("items").filter(new Filter("Scac", "EQ", sCarrier));
					}
				}
			}
		},

		_setRate: function (oShipset, oRate) {
			var oRequestData = this._generateSelectRateUsecase(oShipset, oRate);
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					try {
						// Overwrite original Packing proposal active flag
						this._updateOriginalPackingProposalActive(oData);
						// To store the new common flat sales order structure
						this._overwriteCommonSOFlatStructure(oData);

						var sPath = this.oShipsetTab.getSelectedItem().getBindingContext("global").getPath();
						var aOriginShipsetItem = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject().ShipSetItemSet;
						var aOriginPackProposal = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject().PackingProposalSet;
						var aOriginMoreOption = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject().MoreOptionSet;
						var oObject = oData.ShipSetSet.results[0];
						oObject.ShipSetItemSet = aOriginShipsetItem;
						oObject.PackingProposalSet = aOriginPackProposal;
						oObject.MoreOptionSet = aOriginMoreOption;
						this.getModel("global").setProperty(sPath, oObject);
						this.oRateDialog.close();

						this.oShipsetTab.fireSelectionChange({
							listItems: [this.oShipsetTab.getSelectedItem()]
						});
						// sap.ui.getCore().getEventBus().publish("RATE_QUOTE_SELECTION", {});
					} catch (exc) {
						this.oLog.error(exc);
						MessageBox.error("No data is returned from the RateQuoteSelection usecase!");
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateSelectRateUsecase: function (oShipset, oRate) {
			var oData = {
				Vbeln: this.sSalesOrg,
				Action: "SetRateQuoteSimulation",
				ShipSetSet: [oShipset],
				RatesSet: [oRate]
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_simulate: function (oOrderDetail, aOderItems) {
			var oRequestData = this._generateSimulateUsecase(oOrderDetail, aOderItems);
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					if (oData.ShipSetSet) {
						var aShipsets = oData.ShipSetSet.results;
						for (var i = 0; i < aShipsets.length; i++) {
							if (!aShipsets[i].ShipSetItemSet) {
								aShipsets[i].ShipSetItemSet = [];
							}
						}
						this.getModel("global").setProperty("/ShipSetSimulation", aShipsets);
					}
					if (oData.CarrierListSet) {
						this.getModel("global").setProperty("/CarrierListSet", oData.CarrierListSet.results);
					} else {
						this.getModel("global").setProperty("/CarrierListSet", []);
					}
					if (oData.ServiceListSet) {
						this.getModel("global").setProperty("/ServiceListSet", oData.ServiceListSet.results);
					} else {
						this.getModel("global").setProperty("/ServiceListSet", []);
					}
					this.oShipsetTab.removeSelections();
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateSimulateUsecase: function (oOrderDetail, aOrderItems) {

			var oData = {
				Vbeln: "",
				Action: "BuildShipsetSimulation",
				ShipSetSet: [{
					ShipSetItemSet: []
				}],
				CarrierListSet: [],
				ServiceListSet: [],
				SalesOrderDetails: oOrderDetail,
				SalesOrderItemSet: aOrderItems

			};
			this._addCommonSOFlatStructureToPayload(oData);

			return oData;
		},

		_getRates: function (oObject, sScenario) {
			var oRequestData = this._generateRateUsecase(oObject, sScenario);
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					if (oData.PricProcSet !== null) {
						this.getModel("global").setProperty("/PricProcSet", oData.PricProcSet.results);
					} else {
						this.getModel("global").setProperty("/PricProcSet", []);
					}
					if (oData.RateDetailsSet !== null) {
						this.getModel("global").setProperty("/RateDetailsSet", oData.RateDetailsSet.results);
					} else {
						this.getModel("global").setProperty("/RateDetailsSet", []);
					}
					if (oData.RateErrorSet !== null) {
						this.getModel("global").setProperty("/RateErrorSet", oData.RateErrorSet.results);
					} else {
						this.getModel("global").setProperty("/RateErrorSet", []);
					}
					if (oData.RatesSet !== null) {
						this.getModel("global").setProperty("/RatesSet", oData.RatesSet.results);
					} else {
						this.getModel("global").setProperty("/RatesSet", []);
					}
					if (oData.RateAnalysisSet !== null) {
						this.getModel("global").setProperty("/RateAnalysisSet", oData.RateAnalysisSet.results);
					} else {
						this.getModel("global").setProperty("/RateAnalysisSet", []);
					}
					if (oData.FreightUnitsSet !== null) {
						this.getModel("global").setProperty("/FreightUnitsSet", oData.FreightUnitsSet.results);
					} else {
						this.getModel("global").setProperty("/FreightUnitsSet", []);
					}
					// To store the new common flat sales order structure
					// this._overwriteCommonSOFlatStructure(oData);

					this.oRateDialog = Utils.getFragment(null, "RatesDialog", this);
					this.oRateDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateRateUsecase: function (oObject, sScenario) {
			var oData = {
				Vbeln: this.sSalesOrg,
				Action: "GetSingleCarrierQuoteSimulation",
				ShipSetSet: [oObject],
				RatesSet: [],
				RateDetailsSet: [],
				PricProcSet: [],
				RateAnalysisSet: [],
				RateErrorSet: [],
				FreightUnitsSet: []
			};
			this._addCommonSOFlatStructureToPayload(oData);
			if (sScenario === "S") {
				oData.Action = "GetSingleCarrierQuoteSimulation";
			} else if (sScenario === "O") {
				oData.Action = "GetOptimizedQuoteSimulation";
			} else {
				oData.Action = "GetEstimatedQuoteSimulation";
			}
			return oData;
		},
		_getDefaultSOItemValue: function (sMaterial, sPlant, sCustomer, sPath) {
			this.getModel().callFunction("/GetDefaultOrderItem", {
				method: "GET",
				urlParameters: {
					OrderType: this.sSalesDocType,
					SalesOrg: this.sSalesOrg,
					DistChannel: this.sDistChannel,
					Division: this.sDivision,
					Material: sMaterial,
					Plant: sPlant,
					Customer: sCustomer
				},
				success: function (oData) {
					this.oDefaultOrderItemDetail.UoM = oData.GetDefaultOrderItem.UoM;
					this.oDefaultOrderItemDetail.Plant = oData.GetDefaultOrderItem.Plant;
					this.oDefaultOrderItemDetail.ShippingPoint = oData.GetDefaultOrderItem.ShippingPoint;
					var oOrderItem = this.getModel("global").getProperty(sPath);
					oOrderItem.UoM = oData.GetDefaultOrderItem.UoM;
					oOrderItem.Plant = oData.GetDefaultOrderItem.Plant;
					oOrderItem.ShippingPoint = oData.GetDefaultOrderItem.ShippingPoint;
					this.getModel("global").setProperty(sPath, oOrderItem);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.getModel("global").setProperty("/RateMessagesToFields", []);
					this.hideBusy();
				}.bind(this)
			});
		}
	});
});