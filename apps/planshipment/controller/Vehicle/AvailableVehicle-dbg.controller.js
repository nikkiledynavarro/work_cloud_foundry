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
	"com/erpis/shiperp/planshipment/common/DynamicFilter",
], function (library, BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Token, Utils,
	DynamicFilter) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.planshipment.controller.Vehicle.AvailableVehicle", {

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
			this.getRouter().getRoute("availableVehicle").attachPatternMatched(this._onObjectMatched, this);
		},

		_onObjectMatched: function (oEvent) {
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sWarehouseNumber = oEventArgs.WarehouseNumber;
			this.sLandingPage = oEventArgs.LandingPage;
			var oSmartTable = this._getSmartTable();
			oSmartTable.getTable()._getSelectAllCheckbox().setVisible(false); //Remove check all button
			this.hideBusy();
		},

		_getSmartTable: function () {
			if (!this._VehicleTableSmartTable) {
				this._VehicleTableSmartTable = this.getView().byId("VehicleTable");
			}
			return this._VehicleTableSmartTable;
		},

		onTUScreenPress: function (oEvent) {
			this.getRouter().navTo("availableTus", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber,
				LandingPage: this.sLandingPage
			});
		},

		onPlantoTUScreenPress: function (oEvent) {
			this.getRouter().navTo("outbounddeliveryorder", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber,
				LandingPage: this.sLandingPage
			});
		},

		onBeforeTableRebind: function (oEvent) {
			this.getModel("messageModel").setProperty("/messagesLength", 0);
			this.getModel("messageModel").setProperty("/aMessages", []);
			var oDynamicFilterComp = this._getControlById("DynamicFilter");
			var aDynamicFilters = DynamicFilter._buildFilterArray(oDynamicFilterComp, true, this);
			// Add data filter from initial screen
			var aSmartFilter = aDynamicFilters.slice(0)[0];
			aSmartFilter.aFilters.push(new Filter("Profile", FilterOperator.EQ, this.sProfile));
			aSmartFilter.aFilters.push(new Filter("Station", FilterOperator.EQ, this.sStation));
			aSmartFilter.aFilters.push(new Filter("WarehouseNumber", FilterOperator.EQ, this.sWarehouseNumber));
			this._readTheFilter(aSmartFilter);
		},

		/**
		 * This method will read data from "/VehicleHeaderSet" with aFilters for each type of search for
		 * This method is not designed to be re-used.
		 * @param {sap.ui.model.Filter} 
		 */
		_readTheFilter: function (Filter) {
			this.byId("VehicleTable").setBusy(true);
			this.getModel().read("/VehicleHeaderSet", {
				filters: [Filter],
				urlParameters: {
					select: "VehNum,VehSrActNum,ActId,ActType,ActCat,ActDir,VehNumExt,TspCurr,VehWeight,LoadWeight,Carrier,Service,StatChki,StatChko,StatPgr,StatBgi,StatLs,StatLc,Selected,VehicleNo"
				},
				success: function (oData) {
					this.getView().setModel(new JSONModel(), "oModelVehicle");
					this.getView().getModel("oModelVehicle").setData(oData.results);
					this.byId("VehicleTable").setBusy(false);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
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
		/**
		 ************************** Handle function menu button ***************************************
		 */

		//---Load---/ Start Loading Button /
		onStartLoadingPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateStartLoadingPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateStartLoadingPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_StartLoading",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Load---/  Finish Loading Button /
		onFinishLoadingPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateFinishLoadingPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateFinishLoadingPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_FinishLoading",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Load---/  Reverse Loading Begin Button /
		onReverseLoadingBeginPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseLoadingBeginPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateReverseLoadingBeginPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_ReverseLoadingBegin",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Load---/  Reverse Loading End Button /
		onReverseLoadingEndPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseLoadingEndPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateReverseLoadingEndPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_ReverseLoadingEnd",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Unload---/ Unload Start Loading Button /
		onUnloadStartLoadingPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateUnloadStartLoadingPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateUnloadStartLoadingPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_StartUnloading",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Unload---/ Unload Finish Loading Button /
		onUnloadFinishLoadingPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateUnloadFinishLoadingPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateUnloadFinishLoadingPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_FinishUnloading",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Unload---/ Reverse Unloading Begin Button /
		onReverseUnloadingBeginPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseUnloadingBeginPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateReverseUnloadingBeginPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_ReverseUnloadingBegin",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Unload---/ Reverse Unloading End Button /
		onReverseUnloadingEndPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseUnloadingEndPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateReverseUnloadingEndPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_ReverseUnloadingEnd",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Create new Vehicle---/ Create new Vehicle Button /
		onCreateNewVehicle: function (oEvent) {
			var requestPayload = {
				Action: "VEH_Create",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: [],
				NewVehicle: {},
				Return: []
			};
			
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					var fieldIds = {
						Mtr: "idMTR",
						StartActD: "idStartActD",
						EndActD: "idEndActD",
						EndActT: "idEndActT",
						StartActT: "idStartActT"
					};
					if (!this._oCreateNewVehicle) {
						this._oCreateNewVehicle = Utils.getFragment(null, "Vehicle.CreateNewVehicle", this);
					}
					this._oCreateNewVehicle.setModel(new JSONModel(oData.NewVehicle), "Vehicle");
					for (var key in fieldIds) {
						this.byId((fieldIds[key])).setValueState("None");
					}
					this._oCreateNewVehicle.open();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		
		_checkRequired: function (Value) {
			var fieldIds = {
				Mtr: "idMTR",
				StartActD: "idStartActD",
				EndActD: "idEndActD",
				EndActT: "idEndActT",
				StartActT: "idStartActT"
			};
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

		onAcceptCreateNewVehicleDialog: function (oEvent) {
			var oValue = this._oCreateNewVehicle.getModel("Vehicle").getData();
			var bRequired = this._checkRequired(oValue);
			if (bRequired) {
				this.showBusy();
				var requestPayload = this.generateCreateNewVehiclePayload(oValue);
				this.getModel().create("/ODOTUsQuerySet", requestPayload, {
					success: function (oData) {
						//Handle response here
						this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
						this._oCreateNewVehicle.close();
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
			}

		},

		generateCreateNewVehiclePayload: function (oValue) {
			var aDataVeh = this.getModel("oModelVehicle").getData();
			var oPayload = {
				Action: "VEH_Create",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: (aDataVeh) ? aDataVeh : [],
				NewVehicle: (oValue) ? oValue : {},
				Return: []
			};
			return oPayload;
		},

		onCloseCreateNewVehicleDialog: function (oEvent) {
			this._oCreateNewVehicle.close();
		},

		//---Vehicle Detail---/ Vehicle Detail Button /
		onVehicleDetailPress: function (oEvent) {
			//Set Model for Vehicle Detail screen
			this.getView().setModel(new JSONModel(), "VehicleDetail");
			// Get id smart table
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (index) {
					aSelectedItems.forEach(function (item) {
						if (index.VehNumExt === item.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							index.Selected = "X";
						}
					});
				});
				var requestPayload = this.generateVehiclePayload(aSelectedVeh);
				this.getModel().create("/ODOTUsQuerySet", requestPayload, {
					success: function (oData) {
						if (oData.VehicleDetails) {
							this.getView().getModel("VehicleDetail").setData(oData.VehicleDetails);
							this._GetCarrier(oData.VehicleDetails.Carrier);
						}
						if (!this._oVehicleDetails) {
							this._oVehicleDetails = Utils.getFragment(null, "Vehicle.VehicleDetails", this);
						}
						this._oVehicleDetails.open();
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		onAcceptDetails: function () {
			this.showBusy();
			var oDetail = this.getModel("VehicleDetail").getData();
			var requestPayload = this.generateVehicleDetailPayload(oDetail);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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

		generateVehicleDetailPayload: function (oDetail) {
			var oPayload = {
				Action: "VEH_Update",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: [],
				VehicleDetails: (oDetail) ? oDetail : {},
				Return: []
			};
			return oPayload;
		},

		onCloseVehicleDetails: function (oEvent) {
			this._oVehicleDetails.close();
		},

		//---Vehicle Detail---/ Edit Vehicle Button /
		onEditVehiclePress: function (oEvent) {
			//Set Model for Vehicle Detail screen
			this.getView().setModel(new JSONModel(), "editVehicle");
			// Get id smart table
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (index) {
					aSelectedItems.forEach(function (item) {
						if (index.VehNumExt === item.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							index.Selected = "X";
						}
					});
				});
				var requestPayload = this.generateVehiclePayload(aSelectedVeh);
				this.getModel().create("/ODOTUsQuerySet", requestPayload, {
					success: function (oData) {
						if (oData.VehicleDetails) {
							this.getView().getModel("editVehicle").setData(oData.VehicleDetails);
							this._GetCarrier(oData.VehicleDetails.Carrier);
						}
						if (!this._oEditVehicle) {
							this._oEditVehicle = Utils.getFragment(null, "Vehicle.EditVehicle", this);
						}
						this._oEditVehicle.open();
						this.hideBusy();
					}.bind(this), //eslint-disable-line
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		generateVehiclePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Details",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: (aSelectedVeh) ? aSelectedVeh : [],
				VehicleDetails: {},
				Return: []
			};
			return oPayload;
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

		onAcceptEdit: function () {
			this.showBusy();
			var oEditVehicle = this.getModel("editVehicle").getData();
			var requestPayload = this.generateEditVehiclePayload(oEditVehicle);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
					var aMsg = this._generateMessages(oData.Return.results);
					this._addMessage(aMsg);
					if (aMsg.length > 0) this.byId('popoverButton').firePress();
					this._oEditVehicle.close();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateEditVehiclePayload: function (oEditVehicle) {
			var aDataVeh = this.getModel("oModelVehicle").getData();
			var oPayload = {
				Action: "VEH_Update",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: (aDataVeh) ? aDataVeh : [],
				VehicleDetails: (oEditVehicle) ? oEditVehicle : {},
				Return: []
			};
			return oPayload;
		},

		onCloseVehicleEdit: function (oEvent) {
			this._oEditVehicle.close();
		},
		//---Goods Mvt--/ Good Issue Button /
		onGoodIssuePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateGoodIssuePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateGoodIssuePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_GoodsIssue",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Goods Mvt--/ Reverse Goods Issue Button /
		onReverseGoodsIssuePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseGoodsIssuePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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

		generateReverseGoodsIssuePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_ReverseGoodsIssue",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Goods Mvt--/ Good Receipt Button /
		onGoodReceiptPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateGoodReceiptPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateGoodReceiptPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_GoodsReceipt",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Goods Mvt--/ Reverse Goods Receipt Button /
		onReverseGoodsReceiptPress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseGoodsReceiptPayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateReverseGoodsReceiptPayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_ReverseGoodsReceipt",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Checkpt---/ Arrival Save Button /
		onArrivalSavePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateArrivalSavePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateArrivalSavePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Checkpoint_Arrival",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Checkpt---/ Reverse Arrival Save Button /
		onReverseArrivalSavePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseArrivalSavePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateReverseArrivalSavePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Checkpoint_ReverseArrival",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Checkpt---/ Departure Save Button /
		onDepartureSavePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateDepartureSavePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateDepartureSavePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Checkpoint_Departure",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Checkpt---/ Reverse Departure Save Button /
		onReverseDepartureSavePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateReverseDepartureSavePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateReverseDepartureSavePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Checkpoint_ReverseDeparture",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---TM---/ Send Message Button /
		onSendMessagePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateSendMessagePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateSendMessagePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_TM_SendMessage",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---TM---/ Cancel Message Button /
		onCancelMessagePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateCancelMessagePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateCancelMessagePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_TM_CancelMessage",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Invoice---/ Request Invoice Button /
		onRequestInvoicePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateRequestInvoicePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateRequestInvoicePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Invoice_Request",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Invoice---/ Cancel Inoive Button /
		onCancelInoivePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generateCancelInoivePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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
		generateCancelInoivePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Invoice_Cancel",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//---Invoice---/ Print Invoice Button /
		onPrintInvoicePress: function (oEvent) {
			var oSmartTable = this._getSmartTable();
			var oTable = oSmartTable.getTable();
			var aSelectedItems = oTable.getSelectedItems();
			var aSelectedVeh = oTable.getBinding("items").getModel("oModelVehicle").getData();
			if (aSelectedItems.length === 0) {
				MessageBox.error("Please select at least one Vehicle");
				return;
			} else {
				this.showBusy();
				aSelectedVeh.forEach(function (keyA) {
					aSelectedItems.forEach(function (KeyB) {
						if (keyA.VehNumExt === KeyB.getBindingContext("oModelVehicle").getObject().VehNumExt) {
							keyA.Selected = "X";
						}
					});
				});
			}
			var requestPayload = this.generatePrintInvoicePayload(aSelectedVeh);
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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

		generatePrintInvoicePayload: function (aSelectedVeh) {
			var oPayload = {
				Action: "VEH_Invoice_Print",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: aSelectedVeh,
				Return: []
			};
			return oPayload;
		},

		//--------------- Refresh List Button -----------------------/
		onRefreshListPress: function () {
			this.showBusy();
			var requestPayload = this.generateRefreshListPayload();
			this.getModel().create("/ODOTUsQuerySet", requestPayload, {
				success: function (oData) {
					//Handle response here
					this.getModel("oModelVehicle").setData(oData.AvailableVehicle.results);
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

		generateRefreshListPayload: function () {
			var oPayload = {
				Action: "VEH_RefreshList",
				Profile: this.sProfile,
				Station: this.sStation,
				WarehouseNumber: this.sWarehouseNumber,
				AvailableVehicle: [],
				Return: []
			};
			return oPayload;
		},

		onVehicleNoPressed: function (oEvent) {
			this.showBusy();
			//---------  set data to vehicle No Item page ------
			this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel({
				Vehicle: oEvent.getSource().getBindingContext("oModelVehicle").getObject()
			}), "vehicleModel");
			// --------  Navigate to the page ------------
			this.getRouter().navTo("assignTUs", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},

		onChangeCarrCod: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			this._GetCarrier(sValue);
		},

		onChangeCarrier: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			this._GetCarrier(sValue);
		},
		onSelectionChange: function (oEvent) {
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

		/*---------------------------------------- Handle Message --------------------------------------------------------------- */
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