/*global location*/
sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/planshipment/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/planshipment/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Token",
	"com/erpis/shiperp/planshipment/common/Utils",
	"com/erpis/shiperp/planshipment/common/DynamicFilter"
], function (library, BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Token, Utils,
	DynamicFilter) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.planshipment.controller.ODO.OutboundDeliveryOrder", {

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
			this.onInitCreatedOn(); //set default data for created on
			this.getRouter().getRoute("outbounddeliveryorder").attachPatternMatched(this._onObjectMatched, this);
		},
		_onObjectMatched: function (oEvent) {
			this.hideBusy();
			var oDeferred = $.Deferred();
			var oDeferredVehicle = $.Deferred();
			var oDeferredCarrier = $.Deferred();
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sWarehouseNumber = oEventArgs.WarehouseNumber;
			this.sLandingPage = oEventArgs.LandingPage;
			var oSmartTable = this._getSmartTable();
			oSmartTable.getTable()._getSelectAllCheckbox().setVisible(false); //Remove check all button
			var oDeferredAll = this._loadFilters(); // Call the combined function
			oDeferredAll.done(function () {
				this._filterAllDropdowns();
				this.hideBusy();
			}.bind(this));
		},
		_loadFilters: function () {
			var oDeferredAll = $.Deferred();
			//Warehouse Number
			var oDeferredLgnum = this._GetWarehouseNumberFilter();
			// Get Vehicle
			var oDeferredVehicle = this._GetVehicleFilter();
			// Get staging Area
			var oDeferredStagingArea = this._GetStagingAreaFilter();
			$.when(oDeferredLgnum, oDeferredVehicle, oDeferredStagingArea).done(function () {
				oDeferredAll.resolve();
			});
			return oDeferredAll;
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
		onUpdateFreightUnitTable: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			//Disable check box when freight order is planned
			this.disableCheckBoxWhenFreightOrderPlanned(oSmartTable);
		},
		_getSmartTable: function () {
			if (!this._ODOtSmartTable) {
				this._ODOtSmartTable = this.getView().byId("ODOsTable");
			}
			return this._ODOtSmartTable;
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

		onAssignedFiltersChanged: function (oEvent) {
			//handle show/hide filter groups
			if (this.filterCallback === true) {
				// this.onHandleSmartFilterBarVisible(oEvent);
			}
			var oStatusText = sap.ui.getCore().byId(this.getView().getId() + "--statusText");
			var oFilterBar = sap.ui.getCore().byId(this.getView().getId() + "--smartFilterBar");
			if (oStatusText && oFilterBar) {
				var sText = oFilterBar.retrieveFiltersWithValuesAsText();
				oStatusText.setText(sText);
			}
		},

		_filterAllDropdowns: function () {
			// Filter Door
			this.byId("idDoorComboBox").getBinding("items").filter(new Filter("Lgnum", "EQ", this.sWarehouseNumber));
			// Filter Staging Area Group
			this.byId("idtAGroup").getBinding("items").filter(new Filter("Lgnum", "EQ", this.sWarehouseNumber));
		},
		_GetStagingAreaFilter: function () {
			// Get DropDown
			var oDeferred = $.Deferred();
			var othis = this;
			this.getModel().read("/xSERPERPxCDS_S_AREA", {
				filters: [
					new Filter("Lgnum", "EQ", this.sWarehouseNumber),
				],
				success: function (oData) {
					othis.getModel("local").setProperty("/StagingArea", oData.results);
					oDeferred.resolve();
				},
				error: function (oError) {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_GetWarehouseNumberFilter: function () {
			var oDeferredLgnum = $.Deferred();
			var othis = this;
			this.getModel().read("/xSERPERPxCDS_WHOUSENO", {
				success: function (oData) {
					othis.getModel("local").setProperty("/WarehouseNumberList", oData.results);
					//set selected key for Warehouse Number
					othis.byId("idLgnum").setSelectedKeys(othis.sWarehouseNumber);
					oDeferredLgnum.resolve();
				}.bind(this),
				error: function (oError) {
					oDeferredLgnum.resolve();
				}.bind(this)
			});
			return oDeferredLgnum;
		},

		_GetVehicleFilter: function () {
			var oDeferredVehicle = $.Deferred();
			var othis = this;
			this.getModel().read("/xSERPERPxCDS_VEHICLE", {
				success: function (oData) {
					othis.getModel("local").setProperty("/VehicleList", oData.results);
					oDeferredVehicle.resolve();
				}.bind(this),
				error: function (oError) {
					oDeferredVehicle.resolve();
				}.bind(this)
			});
			return oDeferredVehicle;
		},

		onSubmit: function (oEvent) {
			var oMultiInput = oEvent.getSource();
			var aTokens = oMultiInput.getTokens();
			var sNewValue = oMultiInput.getValue();

			if (sNewValue) {
				var oToken = new sap.m.Token({
					key: sNewValue,
					text: sNewValue
				});
				oMultiInput.addToken(oToken);
				oMultiInput.setValue("");
			}
		},

		onSelectionChangeAreaGroup: function (oEvent) {
			var aSelectedKeys = oEvent.getSource().getSelectedKeys();
			// Filter Staging Area 
			if (aSelectedKeys.length > 0) {
				var oFilterLgnum = new sap.ui.model.Filter("Lgnum", sap.ui.model.FilterOperator.EQ, this.sWarehouseNumber);
				var oFilterLgtyp = new sap.ui.model.Filter("Lgtyp", sap.ui.model.FilterOperator.EQ, aSelectedKeys[0]);
				var oFilter = new sap.ui.model.Filter({
					filters: [oFilterLgnum, oFilterLgtyp],
					and: true
				});
				this.byId("idtArea").getBinding("items").filter(oFilter);
			} else {
				var oFilterArea = new sap.ui.model.Filter("Lgnum", sap.ui.model.FilterOperator.EQ, this.sWarehouseNumber);
				this.byId("idtArea").getBinding("items").filter([oFilterArea]);
			}
		},

		onSelectionChangeCarrier: function (oEvent) {
			var aSelectedKeys = oEvent.getSource().getSelectedKeys();
			// filter Vehicle
			if (aSelectedKeys.length > 0) {
				var aFilters = [];
				for (var i = 0; i < aSelectedKeys.length; i++) {
					var sValue = aSelectedKeys[i];
					if (sValue.length > 0) {
						var oFilter = new sap.ui.model.Filter("Tsp", sap.ui.model.FilterOperator.Contains, sValue);
						aFilters.push(oFilter);
					}
				}
				this.byId("idVehicle").getBinding("items").filter(aFilters);
			} else {
				this.byId("idVehicle").getBinding("items").filter([]);
			}
		},

		onSelectionChangeVehicle: function (oEvent) {
			var aSelectedItems = oEvent.getSource().getSelectedItems();
			this.byId("idCarrier"); // Đảm bảo lấy đúng MultiComboBox
			// Filter Staging Area 
			if (aSelectedItems.length > 0) {
				var aVehicleList = this.getModel("local").getProperty("/VehicleList");
				var aSelectedKeys = aSelectedItems.map(function (item) {
					return item.getBindingContext("local").getObject().Tsp;
				});
				this.byId("idCarrier").setSelectedKeys(aSelectedKeys);
			}
		},

		/**
		 * Handle dynamic filter before bind table
		//  * */
		onBeforeTableRebind: function (oEvent) {
			this.getModel("messageModel").setProperty("/messagesLength", 0);
			this.getModel("messageModel").setProperty("/aMessages", []);
			var oDynamicFilterComp = this._getControlById("DynamicFilter");
			var aDynamicFilters = DynamicFilter._buildFilterArray(oDynamicFilterComp, true, this);
			// Add data filter from initial screen
			var aSmartFilter = aDynamicFilters.slice(0)[0];
			aSmartFilter.aFilters.push(new Filter("Profile", FilterOperator.EQ, this.sProfile));
			aSmartFilter.aFilters.push(new Filter("Station", FilterOperator.EQ, this.sStation));
			// Read the count at this stage because all filters from filterbar are now available
			this._readTheFilter(aSmartFilter);
		},

		onShowOverlay: function (oEvent) {
			oEvent.getParameter("overlay").show = false;
		},

		onQuickFilter: function () {
			this.byId("DynamicFilter").fireSearch();
		},

		// Other events area
		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onDocumentNoPressed: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("documentNoDetail", {
				DocumentNo: oEvent.getSource().getBindingContext("oModelODOTable").getObject().DocumentNo,
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

		onPlanButtonPressed: function (oEvent) {
			this.showBusy();
			var oModel = this.getModel("local");
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedODOs = oTable.getBinding("items").getModel("oModelODOTable").getData();
			var oSelected = aSelectedItems.reduce(function (map, oItem) {
				map[oItem.getBindingContext("oModelODOTable").getObject().DocumentNo] = true;
				return map;
			}, {});

			aSelectedODOs.forEach(function (item) {
				item.Selected = oSelected[item.DocumentNo] ? "X" : "";
			});

			oModel.setProperty("/aSelectedODOs", aSelectedODOs);
			var oRequestPayload = this.generateConsolidatePayload();
			this.getModel().create("/ODOTUsQuerySet", oRequestPayload, {
				success: function (oData) {
					var aOpenAvailableTUs = [];
					if (oData.AvailableTUs && oData.AvailableTUs.results.length > 0) {
						aOpenAvailableTUs = oData.AvailableTUs.results;
					}
					oModel.setProperty("/aOpenAvailableTUs", aOpenAvailableTUs);
					//open dialog
					this._oPlanOrConsolidateDialog = Utils.getFragment(null, "ODO.PlanOrConsolidateDialog", this);
					this._oPlanOrConsolidateDialog.open();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateConsolidatePayload: function () {
			var oPayload = {
				Action: "TU_DisplayConsolidate",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: this.getModel("local").getProperty("/aSelectedODOs"),
				AvailableTUs: []
			};
			return oPayload;
		},
		//Dialog Plan Or Consolidate Handle
		handlePlanConsolidateSearch: function (oEvent) {
			var sValue = oEvent.getParameter("query");
			var aFilters = [];
			if (sValue && sValue.length > 0) {
				aFilters.push(new Filter("TuNum", "Contains", sValue));
			}
			var oPlanConsolidateTbl = this.getView().byId("tblPlanOrConsolidate");
			var oBinding = oPlanConsolidateTbl.getBinding("items");
			oBinding.filter(aFilters);
		},

		onAcceptpressed: function (oEvent) {
			var fieldIds = {
				Mtr: "idMeansOfTrans",
				PackMat: "idPackMaterial",
				StartActD: "idStartActD",
				EndActD: "idEndActD",
				EndActT: "idEndActT",
				StartActT: "idStartActT",
				ActDir: "idActyDire"
			};
			var oVModel = this.getModel("local");
			var aSelectedODOs = oVModel.getProperty("/aSelectedODOs");
			if (aSelectedODOs.length === 0) {
				MessageBox.error("Please select at least one ODOs");
				return;
			}
			var oValue = this._oPlanToNewToDialog.getModel("TUCockpit").getData();
			var bRequired = this._checkRequired(oValue, fieldIds);
			if (bRequired) {
				this.showBusy();
				var requestPayload = this.generateAcceptPayload(aSelectedODOs, oValue);
				this.getModel().create("/ODOTUsQuerySet", requestPayload, {
					success: function (oData) {
						// rebind Table 
						this.byId("ODOsTable").rebindTable();
						//Handle response here
						if (oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						this._oPlanToNewToDialog.close();
						this._oPlanOrConsolidateDialog.close();
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}

		},

		generateAcceptPayload: function (aSelectedODOs, oValue) {
			var arrDropDown = this.getModel("local").getProperty("/aDropdownData");
			var oPayload = {
				Action: "TU_PlantoNewTU",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: [],
				NewTU: oValue,
				OutboundDeliveryOrders: aSelectedODOs,
				Dropdowns: arrDropDown,
				Return: []
			};
			return oPayload;
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

		onCloseDialog: function (oEvent) {
			if (this._oPlanToNewToDialog) {
				this._oPlanToNewToDialog.close();
			}
		},

		onPlanConsolidateDialogPlanNewTUPressed: function () {
			this.showBusy();
			var fieldIds = {
				Mtr: "idMeansOfTrans",
				PackMat: "idPackMaterial",
				StartActD: "idStartActD",
				EndActD: "idEndActD",
				EndActT: "idEndActT",
				StartActT: "idStartActT",
				ActDir: "idActyDire"
			};
			var aSelectedTuItems = this.getView().byId("tblPlanOrConsolidate").getSelectedContexts();
			var aSelectedTU = this.getModel('local').getProperty("/aOpenAvailableTUs");
			var oSelected = aSelectedTuItems.reduce(function (map, oItem) {
				map[oItem.getObject().TuNum] = true;
				return map;
			}, {});
			aSelectedTU.forEach(function (item) {
				item.Selected = oSelected[item.TuNum] ? "X" : "";
			});
			var requestPayload = this._generatePayload(aSelectedTU);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					// Handle response here
					this.getModel("local").setProperty("/aDropdownData", oData.Dropdowns);
					// Dropdown S&R Activity Direction
					if (oData.Dropdowns.ActivityDirection.results.length > 0) {
						this.getModel("local").setProperty("/aActivityDirectionList", oData.Dropdowns.ActivityDirection.results);
					}
					// Dropdown Tu number
					if (oData.Dropdowns.TuNumber.results.length > 0) {
						this.getModel("local").setProperty("/aTuNum_ExtList", oData.Dropdowns.TuNumber.results);
					}
					// Dropdown Parck Material
					if (oData.Dropdowns.PackMaterial.results.length > 0) {
						this.getModel("local").setProperty("/aPackMaterialList", oData.Dropdowns.PackMaterial.results);
					}
					// Dropdown Route 
					if (oData.Dropdowns.Routes.results.length > 0) {
						this.getModel("local").setProperty("/aRouteList", oData.Dropdowns.Routes.results);
					}
					// Dropdown Carrier
					if (oData.Dropdowns.Tsp.results.length > 0) {
						this.getModel("local").setProperty("/aCarrierList", oData.Dropdowns.Tsp.results);
					}
					// Dropdown Means of Transport
					if (oData.Dropdowns.MeansOfTransport.results.length > 0) {
						this.getModel("local").setProperty("/aMeansOfTransportList", oData.Dropdowns.MeansOfTransport.results);
					}
					// Dropdown SCAC
					if (oData.Dropdowns.Scac.results.length > 0) {
						this.getModel("local").setProperty("/aScaccurrList", oData.Dropdowns.Scac.results);
					}

					//open dialog
					if (!this._oPlanToNewToDialog) {
						this._oPlanToNewToDialog = Utils.getFragment(null, "ODO.TransportationUnitCockpit", this);
					}
					Object.assign(oData.NewTU, {
						TusrCarrier: this.oSelected.Carrier,
						TusrService: this.oSelected.Service,
						TusrMiscCarr: this.oSelected.Misccarr,
						TusrLoadNo: this.oSelected.Loadno
					});

					this._oPlanToNewToDialog.setModel(
						new JSONModel(oData.NewTU),
						"TUCockpit"
					);
					for (var key in fieldIds) {
						this.byId((fieldIds[key])).setValueState("None");
					}
					this._oPlanToNewToDialog.open();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePayload: function (aSelectedTU) {
			var oPayload = {
				Action: "TU_DisplayNewTUScreen",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: this.getModel("local").getProperty("/aSelectedODOs"),
				AvailableTUs: aSelectedTU,
				Return: [],
				NewTU: {},
				Dropdowns: {
					dummy: "",
					MeansOfTransport: [],
					ActivityDirection: [],
					PackMaterial: [],
					Scac: [],
					Tsp: [],
					Routes: [],
					TuNumber: [],
				}

			};
			return oPayload;
		},
		//=============================== Add FS ============================
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

		onAssignConsolidatetoExistingTUPressed: function (oEvent) {
			this.showBusy();
			var aSelectedTuItems = this.getView().byId("tblPlanOrConsolidate").getSelectedContexts();
			var aSelectedTU = this.getModel('local').getProperty("/aOpenAvailableTUs");
			var oSelected = aSelectedTuItems.reduce(function (map, oItem) {
				map[oItem.getObject().TuNum] = true;
				return map;
			}, {});
			aSelectedTU.forEach(function (item) {
				item.Selected = oSelected[item.TuNum] ? "X" : "";
			});
			var requestPayload = this.generateAssignConsolidatetoExistingTUPayload(aSelectedTU);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					if (oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
						this._oPlanOrConsolidateDialog.close();
					}

					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		generateAssignConsolidatetoExistingTUPayload: function (aSelectedTU) {
			var oPayload = {
				Action: "TU_PlantoExistingTU",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableTUs: aSelectedTU,
				OutboundDeliveryOrders: this.getModel("local").getProperty("/aSelectedODOs"),
				Return: []
			};
			return oPayload;
		},
		onClosePlanOrConsolidateDialog: function (oEvent) {
			if (this._oPlanOrConsolidateDialog) {
				this._oPlanOrConsolidateDialog.close();
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

		/**
		 * This method will read data from "/ODOHeaderSet" with aFilters for each type of search for
		 * This method is not designed to be re-used.
		 * @param {sap.ui.model.Filter}
		 */
		_readTheFilter: function (Filter) {
			this.byId("ODOsTable").setBusy(true);
			this.getModel().read("/ODOHeaderSet", {
				filters: [Filter],
				urlParameters: {
					select: "DocumentNo,Doccat,DocumentType,ERPDocument,WarehouseNumber,StagingAreaGroup,StagingArea,Stabay,ShipTo,StatusLoad,StatusGm,BillingOption,Docid,Service,Loadno,Misccarr,BillOfLading,PurchaseOrder,PurchaseOrder,PurchaseOrder,HandlingUnit,Vehicle,Route,Vendor,Product,CreatedOn,Selected"
				},
				success: function (oData) {
					this._filterAllDropdowns();
					this.getView().setModel(new JSONModel(), "oModelODOTable");
					this.getView().getModel("oModelODOTable").setData(oData.results);
					this.byId("ODOsTable").setBusy(false);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onNavigateDeliveryOrderDetail: function (oEvent) {
			this.getRouter().navTo("outboundDeliveryOrderDetail", {
				DocumentNo: oEvent.getSource().getBindingContext("oModelODOTable").getObject().DocumentNo,
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},

		onTUScreenPress: function (oEvent) {
			this.getRouter().navTo("availableTus", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber,
				LandingPage: this.sLandingPage
			});
		},
		generatePlantoVehicleScreenPayload: function () {
			var oPayload = {
				Action: "PlantoVehicleScreen",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				OutboundDeliveryOrders: []
			};
			return oPayload;
		},

		ChangeDateRangeSelection: function (oEvent) {
			var sFrom = formatter.formatDate(oEvent.getParameter("from"));
			var sTo = formatter.formatDate(oEvent.getParameter("to"));
			var oBinding = this.byId("idMulDocNo").getBinding("items");
			if (oBinding) {
				oBinding.filter(new Filter("Cretst",
					FilterOperator.BT, sFrom, sTo));
			}
		},

		onVehicleScreenPress: function (oEvent) {
			this.getRouter().navTo("availableVehicle", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber,
				LandingPage: this.sLandingPage
			});
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

		onSelectionChange: function (oEvent) {
			this.oSelected = {
				Service: "",
				Misccarr: "",
				Loadno: "",
				Carrier: ""
			}
			var oTable = oEvent.getSource();
			var aSelectedItems = oTable.getSelectedItems();
			var oBtnPlanODO = this.getView().byId("btnPlanODO");
			if (aSelectedItems.length > 0) {
				var aGetData = aSelectedItems.map(function (item) {
					return item.getBindingContext("oModelODOTable").getObject();
				});
				if (aGetData.length === 1) {
					this.oSelected = aGetData[0];
				} else {
					aGetData.some(function (oData, index, aData) {
						if (aData.map(function (obj) {
								return obj.Carrier;
							}).indexOf(oData.Carrier) !== index) {
							this.oSelected = oData;
							return true;
						}
						return false;
					}.bind(this));
				}
				oBtnPlanODO.setEnabled(true);
			} else {
				oBtnPlanODO.setEnabled(false);
			}
		}
	});
});