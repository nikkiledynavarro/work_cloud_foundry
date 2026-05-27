/*global location*/
sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/tuv/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/hr7/tuv/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Token",
	"com/erpis/shiperp/hr7/tuv/common/Utils",
	"com/erpis/shiperp/hr7/tuv/common/DynamicFilter",
	"com/erpis/shiperp/hr7/tuv/common/HttpHelper"
], function (library, BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Token, Utils,
	DynamicFilter, HttpHelper) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.tuv.controller.TU.AvailableTus", {

		formatter: formatter,
		oBundle: null, // i18n bundle class
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			this.filterCallback = true; //for init change dynamic filter
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				messagesLength: 0,
			});
			this.setModel(oViewModel, "local");

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			this.getRouter().getRoute("availableTus").attachPatternMatched(this._onObjectMatched, this);
		},

		onSelectionChange: function (oEvent) {
			var oTable = oEvent.getSource();
			var aSelectedItems = oTable.getSelectedItems();
			var oBtnPlanVehicle = this.getView().byId("btnPlanVehicle");
			oBtnPlanVehicle.setEnabled(aSelectedItems.length > 0);
		},

		_onObjectMatched: function (oEvent) {
			this.hideBusy();
			// this.onInitCreatedOn(); //set default data for created on
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sWarehouseNumber = oEventArgs.WarehouseNumber;
			this.sLandingPage = oEventArgs.LandingPage;
			var oSmartTable = this._getSmartTable();
			this._bindView();
			oSmartTable.getTable()._getSelectAllCheckbox().setVisible(false); //Remove check all button
		},
		onAfterRendering: function () {
			// Applied to fix overlap footer css issue (This issue is fixed when upgrade to 1.44 or above)
			var oFUTab = this._getControlById("itbFreightUnit");
			this.checkSapUi5Version(oFUTab);
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		disableCheckBoxWhenFreightOrderPlanned: function (oSmartTable) {

			var aFreightItems = oSmartTable.getTable().getItems();
			for (var i = 0; i < aFreightItems.length; i++) {
				var oCurrentItem = aFreightItems[i].getBindingContext().getObject();
				aFreightItems[i].getModeControl().setEnabled(true);
				if (oCurrentItem.PlanningStatus === "03") {
					aFreightItems[i].getModeControl().setEnabled(false);
				}
			}

		},

		_bindView: function () {
			this.byId("TUsTable").setBusy(true);
			var aFilters = [];
			aFilters.push(new Filter("Profile", FilterOperator.EQ, this.sProfile));
			aFilters.push(new Filter("Station", FilterOperator.EQ, this.sStation));
			aFilters.push(new Filter("WarehouseNumber", FilterOperator.EQ, this.sWarehouseNumber));
			this.getModel().read("/TuHeaderSet", {
				filters: aFilters,
				urlParameters: {
					select: "select=TspCurr,TspCurrText,TuNum,TuSrActNum,IconAsgnChanged,StatLs,StatLc,StatChki,StatChko,StatBgi,StatPgi,Selected"
				},
				success: function (oData) {
					if (oData) {
						var oModel = new JSONModel();
						oModel.setData(oData.results);
						this.getView().setModel(oModel, "oModelSmartTable");
						this.byId("TUsTable").setBusy(false);
					}
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.byId("TUsTable").setBusy(false);
				}.bind(this)
			});
		},

		onBeforeTableRebind: function (oEvent) {
			this._bindView();
		},

		onUpdateFreightUnitTable: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			//Disable check box when freight order is planned
			this.disableCheckBoxWhenFreightOrderPlanned(oSmartTable);
		},
		_getSmartTable: function () {
			if (!this._TUsSmartTable) {
				this._TUsSmartTable = this.getView().byId("TUsTable");
			}
			return this._TUsSmartTable;
		},
		onSort: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Sort");
			}
		},

		onFilter: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Filter");
			}
		},

		onGroup: function () {
			MessageToast.show("Not available as this feature is disabled for this app in the view.xml");
		},

		onColumns: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Columns");
			}
		},

		onShowOverlay: function (oEvent) {
			oEvent.getParameter("overlay").show = false;
		},

		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onDocumentNoPressed: function (oEvent) {
			var oItem = oEvent.getSource();
			this.showBusy();
			this.getRouter().navTo("documentNoDetail", {
				DocumentNo: oItem.getBindingContext().getProperty("DocumentNo"),
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},
		onNavToFreightOrderPressed: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("freightOrder", {
				Station: this.sStation,
				Profile: this.sProfile
			});
		},
		onSelectionChanged: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItems = oTableData.getSelectedItems();
			//uncheck all items planned
			for (var i = 0; i < aSelectedItems.length; i++) {
				var currentItem = aSelectedItems[i].getBindingContext().getObject();
				if (currentItem.OverallStatus === "O") {
					oTableData.setSelectedItem(aSelectedItems[i], false);
				}
			}
		},
		onPlanVehiclePressed: function (oEvent) {
			this.showBusy();
			var oModel = this.getModel("local");
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedTUs = oTable.getBinding("items").getModel("oModelSmartTable").getData();
			aSelectedTUs.forEach(function (item) {
				aSelectedItems.forEach(function (Key) {
					if (item.TuNum === Key.getBindingContext("oModelSmartTable").getObject().TuNum) {
						item.Selected = "X";
					}
				});
			});
			oModel.setProperty("/aSelectedTUs", aSelectedTUs);
			var oRequestPayload = this.generateConsolidatePayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.AvailableVehicle && oData.AvailableVehicle.results.length > 0) {
						oModel.setProperty("/aAvailableVehicleList", oData.AvailableVehicle.results);
					} else {
						oModel.setProperty("/aAvailableVehicleList", []);
					}

					//open dialog
					this._oPlanOrConsolidateVEH = Utils.getFragment(null, "Vehicle.PlanOrConsolidateVehicle", this);
					this._oPlanOrConsolidateVEH.open();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateConsolidatePayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "VEH_DisplayConsolidate",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: aSelectedTUs,
				AvailableVehicle: []
			};
			return oPayload;
		},

		onSearchConsolidateVehicle: function (oEvent) {
			var sValue = oEvent.getParameter("query");
			var aFilters = [];
			if (sValue && sValue.length > 0) {
				aFilters.push(new Filter("VehNumExt", "Contains", sValue));
			}
			var oPlanConsolidate = this.getView().byId("idPlanOrConsolidateVEH");
			var oBinding = oPlanConsolidate.getBinding("items");
			oBinding.filter(aFilters);
		},

		onAcceptPlan: function (oEvent) {
			var fieldIds = {
				Mtr: "idMTR",
				StartActD: "idStartActD",
				EndActD: "idEndActD",
				EndActT: "idEndActT",
				StartActT: "idStartActT"
			};
			var oValue = this._oPlanVehicle.getModel("Vehicle").getData();
			var bRequired = this._checkRequired(oValue, fieldIds);
			if (bRequired) {
				this.byId("idVehicleCockpit").setBusy(true);
				var requestPayload = this.generateAcceptPayload(oValue);
				this.getModel().create("/ODOTUsQuerySet", requestPayload, {
					success: function (oData) {
						// rebind Table 
						this.byId("TUsTable").rebindTable();
						if (oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
							this.byId("idVehicleCockpit").setBusy(false);
						}
						this._oPlanVehicle.close();
						this._oPlanOrConsolidateVEH.close();
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.byId("idVehicleCockpit").setBusy(false);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		generateAcceptPayload: function (oValue) {
			var oPayload = {
				Action: "VEH_Plan",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: this.getModel("local").getProperty("/aSelectedTUs"),
				NewVehicle: oValue,
				OutboundDeliveryOrders: [],
				Return: []
			};
			return oPayload;
		},

		onCloseDialog: function (oEvent) {
			if (this._oPlanVehicle) {
				this._oPlanVehicle.close();
				this.hideBusy();
			}
		},

		onPlantoNewVehiclePressed: function () {
			this.showBusy();
			var fieldIds = {
				Mtr: "idMTR",
				StartActD: "idStartActD",
				EndActD: "idEndActD",
				EndActT: "idEndActT",
				StartActT: "idStartActT"
			};
			var requestPayload = {
				Action: "VEH_Plan",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: this.getModel("local").getProperty("/aSelectedTUs"),
				NewVehicle: {},
				OutboundDeliveryOrders: [],
				Return: []
			};
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//open dialog
					if (!this._oPlanVehicle) {
						this._oPlanVehicle = Utils.getFragment(null, "Vehicle.VehicleCockpit", this);
					}
					this._oPlanVehicle.setModel(new JSONModel(oData.NewVehicle), "Vehicle");
					for (var key in fieldIds) {
						this.byId((fieldIds[key])).setValueState("None");
					}
					this._oPlanVehicle.open();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.byId("idVehicleCockpit").setBusy(false);
					this.hideBusy();
				}.bind(this)
			});
		},

		onChangeCarrierCod: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			this._GetCarrier(sValue);
		},
		_GetCarrier: function (sValue) {
			this.getModel().read("/xSERPERPxCDS_SERVICES", {
				filters: [
					new Filter("Carrier", "EQ", sValue),
				],
				success: function (oData) {
					this.getModel("local").setProperty("/ServiceList", oData.results);
				}.bind(this),
				error: function (oError) {}.bind(this)
			});
		},

		onAssignToVehiclePressed: function () {
			this.showBusy();
			var aSelectedTuItems = this.getView().byId("idPlanOrConsolidateVEH").getSelectedContexts();
			var aSelectedVehicle = this.getModel('local').getProperty("/aAvailableVehicleList");
			aSelectedVehicle.forEach(function (item) {
				aSelectedTuItems.forEach(function (Key) {
					if (item.VehNumExt === Key.getObject().VehNumExt) {
						item.Selected = "X";
					}
				});
			});
			var requestPayload = this.generateAssignConsolidatetoExistingVEHPayload(aSelectedVehicle);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this._oPlanOrConsolidateVEH.close();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateAssignConsolidatetoExistingVEHPayload: function (aSelectedVehicle) {
			var oPayload = {
				Action: "VEH_Plan",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVehicle,
				AvailableTUs: this.getModel("local").getProperty("/aSelectedTUs"),
				OutboundDeliveryOrders: [],
				Return: []
			};
			return oPayload;
		},
		onClosePlan: function (oEvent) {
			if (this._oPlanOrConsolidateVEH) {
				this._oPlanOrConsolidateVEH.close();
			}
		},
		//end Handle Dialog

		/**
		 * Event handler when user close Simulate dialog
		 * @public
		 */
		onSimClose: function () {
			this._oDialogSim.close();
		},

		/**
		 * Event handler when user clear messages in popover
		 * @public
		 */
		onClearMessagesButtonPressed: function () {
			this._clearMessages(this, "local");
		},

		onNavigateDeliveryOrderDetail: function (oEvent) {
			this.getRouter().navTo("outboundDeliveryOrderDetail", {
				DocumentNo: oEvent.getSource().getBindingContext("oModelODOTable").getObject().DocumentNo,
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},

		/**	 Header Button   */
		onPlantoTUScreenPress: function (oEvent) {
			this.getRouter().navTo("outbounddeliveryorder", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber,
				LandingPage: this.sLandingPage
			});
		},

		onVehicleScreenPress: function (oEvent) {
			this.getRouter().navTo("availableVehicle", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber,
				LandingPage: this.sLandingPage
			});
		},

		generatePlantoTUScreenPayload: function () {
			var oPayload = {
				Action: "PlantoTUScreen",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: []
			};
			return oPayload;
		},

		//---Load---/ Load Menu Button /
		onStartLoadingPress: function () {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateStartLoadingPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateStartLoadingPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_StartLoading",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Load---/ Finish Loading Button /
		onFinishLoadingPress: function () {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateFinishLoadingPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateFinishLoadingPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_FinishLoading",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Load---/ Reverse Loading Begin Button /
		onReverseLoadingBeginPress: function () {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateReverseLoadingBeginPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateReverseLoadingBeginPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_ReverseLoadingBegin",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Load---/ Reverse Loading End Button /
		onReverseLoadingEndPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateReverseLoadingEndPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateReverseLoadingEndPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_ReverseLoadingEnd",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Create Warehouse Task---/ Create WT Button /
		onCreateWTPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateCreateWTPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateCreateWTPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_CreateWT",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Goods Movement---/ Good Issue Button /
		onGoodsIssuePress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item)
			});
			var requestPayload = this.generateGoodsIssuePayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateGoodsIssuePayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_GoodsIssue",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Goods Movement---/ Reverse Good Issue Button /
		onReversegGoodsiIssuePress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item)
			});
			var requestPayload = this.generateReversegGoodsiIssuePayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateReversegGoodsiIssuePayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_ReverseGoodsIssue",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Goods Movement---/ Good Receipt Button /
		onGoodsReceiptPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateGoodsReceiptPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateGoodsReceiptPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_GoodsReceipt",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Goods Movement---/ Reverse Good Receipt Button /
		onReverseGoodsReceiptPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateReverseGoodsReceiptPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateReverseGoodsReceiptPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_ReverseGoodsReceipt",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Door---/ Asign Door Button /
		onAssignDoorPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItems = oTableData.getSelectedContexts();
			//open dialog
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one TUs");
				return;
			} else {
				var fieldIds = {
					Door: "idDoor",
					StartActD: "idDoorStartActD",
					EndActD: "idDoorEndActD",
					EndActT: "idDoorEndActT",
					StartActT: "idDoorStartActT"
				};
				var requestPayload = {
					Action: "TU_AssignDoor",
					Profile: this.sProfile,
					Station: this.sStation,
					WarehouseNumber: this.sWarehouseNumber,
					Door: {},
					Return: [],
					AvailableTUs: []
				};
				this.getModel().create("/ODOTUsQuerySet", requestPayload, {
					success: function (oData) {
						//Handle response here
						Object.assign(oData.Door, {
							Lgnum: this.sWarehouseNumber
						});
						if (!this.oDialogAssignDoor) {
							this.oDialogAssignDoor = Utils.getFragment(null, "ODO.AssignDoorDialog", this);
						}
						this.oDialogAssignDoor.setModel(new JSONModel(oData.Door), "AssignDoor");
						for (var key in fieldIds) {
							this.byId((fieldIds[key])).setValueState("None");
						}
						this.oDialogAssignDoor.open();
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		generateDoorScreenPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_DoorScreen",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: aSelectedTUs,
				Door: {},
				Dropdowns: {
					dummy: "",
					MeansOfTransport: [],
					ActivityDirection: [],
					PackMaterial: [],
					Scac_curr: [],
					Tsp_Curr: [],
					Routes: [],
					TuNum_Ext: [],
					Vehicle: []
				},
				Return: []
			};
			return oPayload;
		},

		//---Door---/ Arrival At Door Button /
		onArrivalatDoorPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateArrivalatDoorPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateArrivalatDoorPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_ArrivalatDoor",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: aSelectedTUs,
				Door: {},
				Dropdowns: {
					dummy: "",
					MeansOfTransport: [],
					ActivityDirection: [],
					PackMaterial: [],
					Scac_curr: [],
					Tsp_Curr: [],
					Routes: [],
					TuNum_Ext: [],
					Vehicle: []
				},
				Return: []
			};
			return oPayload;
		},

		//---Door---/ Departure From Door Button /
		onDepartureFromDoorPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateDepartureFromDoorPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateDepartureFromDoorPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_DepartureFromDoor",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: aSelectedTUs,
				Door: {},
				Dropdowns: {
					dummy: "",
					MeansOfTransport: [],
					ActivityDirection: [],
					PackMaterial: [],
					Scac_curr: [],
					Tsp_Curr: [],
					Routes: [],
					TuNum_Ext: [],
					Vehicle: []
				},
				Return: []
			};
			return oPayload;
		},

		//---Assign Vehicle---/ Assign Vehicle Button /
		onAssignVehiclePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItems = oTableData.getSelectedContexts();

			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one TUs");
				return;
			} else {
				this.showBusy();
				this.getModel().read("/xSERPERPxCDS_VEH_SR_ACT", {
					success: function (oData) {
						this.getModel("local").setProperty("/CarrierList", oData.results);
						if (!this._oAssignVehicle) {
							this._oAssignVehicle = Utils.getFragment(null, "ODO.AssignVehicleDialog", this);
						}
						this._oAssignVehicle.setModel(
							new JSONModel({
								VehNumExt: "",
								TspCurr: "",
								ScacCurr: "",
								VehSrActNum: ""
							}),
							"AssignVehicle"
						);
						this.byId("idVehicle").setSelectedKey("");
						this.byId("idAssignCarrier").setSelectedKey("");
						this.byId("idActyVehicle").setSelectedKey("");
						this._oAssignVehicle.open();
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		//---Checkpoint---/ Arrival Button /
		onArrivalPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item)
			});
			var requestPayload = this.generateArrivalPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateArrivalPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_Checkpoint_Arrival",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Checkpoint---/ Reverse Arrival Button /
		onReverseArrivalPress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item)
			});
			var requestPayload = this.generateReverseArrivalPayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateReverseArrivalPayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_Checkpoint_ReverseArrival",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Checkpoint---/ Departure Button /
		onDeparturePress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateDeparturePayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateDeparturePayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_Checkpoint_Departure",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		//---Checkpoint---/ Reverse Departure Button /
		onReverseDeparturePress: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateReverseDeparturePayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateReverseDeparturePayload: function (aSelectedTUs) {
			var oPayload = {
				Action: "TU_Checkpoint_ReverseDeparture",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Return: []
			};
			return oPayload;
		},

		onCloseAssignDoorDialog: function () {
			if (this.oDialogAssignDoor) {
				this.oDialogAssignDoor.close();
			}
		},
		onAcceptAssignDoor: function (oEvent) {
			var fieldIds = {
				Door: "idDoor",
				StartActD: "idDoorStartActD",
				EndActD: "idDoorEndActD",
				EndActT: "idDoorEndActT",
				StartActT: "idDoorStartActT"
			};
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var oValue = this.oDialogAssignDoor.getModel("AssignDoor").getData();
			var bRequired = this._checkRequired(oValue, fieldIds);
			if (bRequired) {
				this.showBusy();
				var requestPayload = this.generateAssignDoorPayload(aSelectedTUs, oValue);
				this.getModel().create("/ODOTUsQuerySet", requestPayload, {
					success: function (oData) {
						//Handle response here
						this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
						this.oDialogAssignDoor.close();
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		_checkRequired: function (Value, fieldIds) {
			var hasError = false;
			for (var key in Value) {
				if (Value.hasOwnProperty(key) && fieldIds.hasOwnProperty(key)) {
					if (Value[key] === "") {
						this.byId(fieldIds[key]).setValueState("Error");
						hasError = true;
					} else {
						this.byId(fieldIds[key]).setValueState("None");
					}
				}
			}
			return !hasError;
		},

		generateAssignDoorPayload: function (aSelectedTUs, oAssignDoor) {
			var oPayload = {
				Action: "TU_AssignDoor",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: aSelectedTUs,
				Door: (oAssignDoor) ? oAssignDoor : {},
				Dropdowns: {
					dummy: "",
					MeansOfTransport: [],
					ActivityDirection: [],
					PackMaterial: [],
					Scac_curr: [],
					Tsp_Curr: [],
					Routes: [],
					TuNum_Ext: [],
					Vehicle: []
				},
				Return: []
			};
			return oPayload;
		},

		_LoadData: function () {
			this._oAssignVehicle.open();
			this.hideBusy();
		},

		onCloseAssignVehicleDialog: function () {
			if (this._oAssignVehicle) {
				this._oAssignVehicle.close();
			}
		},

		onAcceptAssignVehicle: function (oEvent) {
			this.showBusy();
			var oSmartTable = this._getSmartTable();
			var oTableData = oSmartTable.getTable();
			var aSelectedItem = oTableData.getSelectedItem().getBindingContext("oModelSmartTable").getObject();
			var aDataTable = oTableData.getBinding("items").getModel("oModelSmartTable").getData();
			var aSelectedTUs = [];
			aDataTable.forEach(function (item) {
				if (item.TuNum === aSelectedItem.TuNum) {
					item.Selected = "X";
				}
				aSelectedTUs.push(item);
			});
			var requestPayload = this.generateAssignVehiclePayload(aSelectedTUs);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelSmartTable").setData(oData.AvailableTUs.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this._oAssignVehicle.close();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateAssignVehiclePayload: function (aSelectedTUs) {
			this.aSelectedTUs = this.getModel("local").getProperty("/TUs");
			this.aVehicle = this._oAssignVehicle.getModel("AssignVehicle").getData();
			var oPayload = {
				Action: "TU_AssignVehicle",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: [],
				AvailableTUs: (aSelectedTUs) ? aSelectedTUs : [],
				Vehicle: (this.aVehicle) ? this.aVehicle : {},
				Dropdowns: {
					dummy: "",
					MeansOfTransport: [],
					ActivityDirection: [],
					PackMaterial: [],
					Scac_curr: [],
					Tsp_Curr: [],
					Routes: [],
					TuNum_Ext: [],
					Vehicle: []
				},
				Return: []
			};
			return oPayload;
		},

		onchangeVehicle: function (oEvent) {
			var sValue = oEvent.getSource().getSelectedItem().getBindingContext().getObject();
			this.byId("idAssignCarrier").setSelectedKey(sValue.Tsp);
		},

		onchangeActyVehicle: function (oEvent) {
			var sValue = oEvent.getSource().getSelectedItem().getBindingContext("local").getObject();
			this.byId("idVehicle").setSelectedKey(sValue.VehNum);
			this.byId("idAssignCarrier").setSelectedKey(sValue.vehcarrier);
		},

		_getCarrrier: function (sValue) {
			this.getModel().read("/xSERPERPxCDS_VEH_SR_ACT", {
				filters: [
					new Filter("VehNum", "EQ", "00000000" + sValue.VehNum),
				],
				success: function (oData) {
					this.getModel("local").setProperty("/CarrierList", oData.results);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onSelectionVehicleConsolidate: function (oEvent) {
			var oTab = oEvent.getSource();
			var aList = oTab.getSelectedItems();
			if (aList.length > 0) {
				if (aList.length > 1) {
					MessageBox.error("Please select only one vehicle");
					oTab.getSelectedItem().setSelected(false);
					return;
				} else {
					oTab.getSelectedItem().setSelected(true);
				}
			}
		},

		/* Handle Message */
		_generateMessages: function (aParamMessages) {
			var aMessages = [];
			for (var i = 0; i < aParamMessages.length; i++) {
				var oMessage = this._generateMessageObject(aParamMessages[i]);
				if (oMessage) {
					aMessages.push(oMessage);
				}
			}
			return aMessages;
		},
		_generateMessageObject: function (oPassMessage) {
			var oMessage = {
				type: "Warning",
				title: oPassMessage.Message,
				description: ""
			};
			switch (oPassMessage.Type) {
			case "E":
				oMessage.type = library.Error;
				break;
			case "W":
				oMessage.type = library.Warning;
				break;
			case "I":
				oMessage.type = library.Information;
				break;
			case "S":
				oMessage.type = library.Success;
				break;
			default:
				oMessage.type = library.Warning;
				break;
			}
			return oMessage;
		},
	});
});