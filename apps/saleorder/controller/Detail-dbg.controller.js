/*global location */
sap.ui.define([
	"com/erpis/shiperp/salesorder/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/salesorder/hr7/model/formatter",
	"sap/ui/Device",
	"com/erpis/shiperp/salesorder/hr7/common/Utils",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, Device, Utils, MessageBox, MessageToast, History, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.saleorder.controller.Detail", {

		formatter: formatter,
		sSalesNo: "", // key for navigate from master to detail,
		oShipsetTab: null, // shipset table.
		oBundle: null, // i18n bundle class
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();
			this.oShipsetTab = this.byId("listDetail");
			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			sap.ui.getCore().getEventBus().subscribe("REFRESH_PAGE", function () {
				this._onBindingChange();
			}.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.getModel("global").setProperty("/dontRefresh", false);
			this.sSalesNo = oEvent.getParameter("arguments").SalesNo;
			this.byId("btnPackProposal").setEnabled(false);
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");

			// Bind Header
			this.getModel().metadataLoaded().then(function () {
				this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
				var sObjectPath = this.getModel().createKey("SalesOrderListSet", {
					SalesNo: this.sSalesNo
				});
				// Bind VBAK Information
				this.getView().bindElement({
					path: "/" + sObjectPath,
					events: {
						change: this._onBindingChange.bind(this)
					}
				});
			}.bind(this));
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				return;
			} else {
				// Bind Shipset table
				if (this.getModel("global").getProperty("/dontRefresh")) {
					this.getModel("global").setProperty("/dontRefresh", false);
				} else {
					// Refresh Header data
					oElementBinding.refresh();
					this.getModel("global").setProperty("/dontRefresh", true);
					// Refresh Association to_soldTo
					this.getModel().resetChanges();

					// Refresh Delivery block
					this.getModel().read(oElementBinding.getPath() + "/to_deliBlock", {
						success: function (oData) {
							var oDeliveryBlock = this.byId("deliveryBlock");
							oDeliveryBlock.setActive(false);
							if (!oData || oData.results.length === 0) {
								oDeliveryBlock.setText("");
								return;
							}
							if (oData.results.length > 1) {
								oDeliveryBlock.setActive(true);
								oDeliveryBlock.setText("Multiple");
								oDeliveryBlock.addStyleClass("underline");
								if (!this.oDeliveryPopover) {
									this.oDeliveryPopover = new sap.m.Popover({
										showHeader: false,
										content: [
											new sap.m.List({
												items: {
													path: "/",
													template: new sap.m.StandardListItem({
														title: "{DelivBlockDesc}"
													})
												}
											})
										]
									});
								}
								this.oDeliveryPopover.setModel(new JSONModel(oData.results));
							} else {
								oDeliveryBlock.setText(oData.results[0].DelivBlockDesc);
							}
						}.bind(this)
					});

					// Bind Shipset Table
					this._getShipsets();
				}

				this.oShipsetTab.removeSelections();
			}
		},

		onMultipleDeliveryPress: function (oEvent) {
			this.oDeliveryPopover.openBy(oEvent.getSource());
		},

		/**
		 * Set the full screen mode to false and navigate to master page
		 */
		onCloseDetailPress: function () {
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
			this.oShipsetTab.removeSelections();
			this.getRouter().navTo("master");
		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		onToggleFullScreen: function () {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		},

		/**
		 * Event handler for the list selection event
		 * @param {sap.ui.base.Event} oEvent the list selectionChange event
		 * @public
		 */
		onSelectionChange: function (oEvent) {
			var oList = oEvent.getSource(),
				bSelected = oEvent.getParameter("selected");

			// skip navigation when deselecting an item in multi selection mode
			if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
				// get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
				this.oShipsetTab.removeSelections(true);
				this.byId("btnPackProposal").setEnabled(false);
				this._showObjectDetail(oEvent.getParameter("listItem") || oEvent.getSource());
			}
		},

		onCheckPackProposalActive: function (oEvent) {
			if (oEvent.getParameter("listItem").getBindingContext("global").getObject().PropActive) {
				this.byId("btnPackProposal").setEnabled(true);
			} else {
				this.byId("btnPackProposal").setEnabled(false);
			}
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

		onPackProposal: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getPackProposal(oObject);
		},

		onProposalDlgCancel: function (oEvent) {
			// Reset manual change value to original one
			this._resetProposal();
			this.oPackProposalDialog.close();
		},

		onProposalDlgContinue: function (oEvent) {
			this._syncPackproposalData();
			this.oPackProposalDialog.close();
		},

		onSingleRate: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getRates(oObject, "S");
		},

		onRateShop: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getRates(oObject, "R");
		},

		onOptimization: function (oEvent) {
			var oItem = this.oShipsetTab.getSelectedItem();
			if (!oItem) {
				MessageBox.error("Please select a shipset to continue!");
				return;
			}
			var oObject = oItem.getBindingContext("global").getObject();
			this._getRates(oObject, "O");
		},

		onRateDialogCancel: function (oEvent) {
			this.oRateDialog.close();
		},

		onCloseRateDialog: function (oEvent) {
			this.oRateDialog.close();
		},

		onShowRatePricingDetail: function () {
			var oRateTab = this.getView().byId("tableRates");
			if (oRateTab.getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			this.oRatePricingDialog = Utils.getFragment(null, "RatePricingsDialog", this);
			var oObject = oRateTab.getSelectedItem().getBindingContext("global").getObject();
			var oRatePricingTemplate = sap.ui.xmlfragment("com.erpis.shiperp.saleorder.fragment.RatePricingColumnListItem", this);
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

		onCloseRatePricingDialog: function () {
			this.oRatePricingDialog.close();
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

		onCloseRateAnalysisDetail: function () {
			this.oRateAnalysisDialog.close();
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
				this.getModel("global").setProperty("/RateAnalysis", []);
			}
		},

		onEditHUDimension: function (oEvent) {
			this.oEditHUDimensionDialog = Utils.getFragment(null, "EditHUDimensionDialog", this);
			this.oEditHUDimensionDialog.bindElement("global>" + oEvent.getSource().getBindingContext("global").getPath());
			this.oEditHUDimensionDialog.open();
		},

		onConfirmUpdateHUDimension: function () {
			this.oEditHUDimensionDialog.close();
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

		onShowRateDetail: function () {
			if (this.byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}

			this.oRateDetailDialog = Utils.getFragment(null, "RateDetailsDialog", this);

			var oObject = this.byId("tableRates").getSelectedItem().getBindingContext("global").getObject();
			var oRateDetailTemplate = sap.ui.xmlfragment("com.erpis.shiperp.saleorder.fragment.RateDetailColumnListItem", this);
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

		onCloseRateDetailDialog: function () {
			this.oRateDetailDialog.close();
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

		onPackHU: function (oEvent) {
			var oNode = oEvent.getParameter("droppedControl").getBindingContext("global").getObject();
			var oUnpackNode = oEvent.getParameter("draggedControl").getBindingContext("global").getObject();
			if (!oNode.Exidv) {
				MessageToast.show(this.oBundle.getText("actionPackNotPossible"));
				return;
			}
			// Call Pack HU
			this._packHU(oNode.NodeId, [oUnpackNode]);
		},

		onUnpackHU: function (oEvent) {
			var oNode = oEvent.getParameter("draggedControl").getBindingContext("global").getObject();
			if (oNode.Exidv) {
				MessageToast.show(this.oBundle.getText("actionUnPackNotPossible"));
				return;
			}
			// Call Unpack HU
			this._unpackHU([oNode]);
		},

		onAddressValidation: function (oEvent) {
			var oRequestData = this._generateValidateAddressUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					var oNewAddress = oData.AddressNew;
					var oAddressOrigin = oData.AddressOriginal;
					this.getModel("global").setProperty("/NewAddress", oNewAddress);
					this.getModel("global").setProperty("/AddressOriginal", oAddressOrigin);
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);

					this.oValidateAdressDialog = Utils.getFragment("", "ValidateAddressDialog", this);
					this.oValidateAdressDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onValidateEmailDialogClose: function () {
			this.oValidateAdressDialog.close();
		},

		onValidateAddressConfirmPress: function () {
			var oNewAddress = this.getModel("global").getProperty("/NewAddress");
			var OldAddress = this.getModel("global").getProperty("/AddressOriginal");
			this._copyObject(OldAddress, oNewAddress);
			this.getModel("global").setProperty("/AddressOriginal", OldAddress);
			this.oValidateAdressDialog.close();

			// Update new Address to to_shipTo
			var sPath = this.getView().getBindingContext().getPath();
			this.getModel().setProperty(sPath + "/to_shipTo/City", OldAddress.Ort01);
			this.getModel().setProperty(sPath + "/to_shipTo/Country", OldAddress.Land1);
			this.getModel().setProperty(sPath + "/to_shipTo/Name1", OldAddress.Name1);
			this.getModel().setProperty(sPath + "/to_shipTo/PostalCode", OldAddress.Pstlz);
			this.getModel().setProperty(sPath + "/to_shipTo/Region", OldAddress.Regio);
			this.getModel().setProperty(sPath + "/to_shipTo/Street", OldAddress.Stras);
		},

		onUnpackButtonPress: function (oEvent) {
			var oPackTable = this.byId("idPackProposalTab");
			var aSelectedIndices = oPackTable.getSelectedIndices();
			var aData = [];
			if (aSelectedIndices.length === 0) {
				MessageToast.show("Select at least one row first.");
				return;
			}
			for (var i = 0; i < aSelectedIndices.length; i++) {
				var oContext = oPackTable.getContextByIndex(aSelectedIndices[i]);
				var oNode = oContext.getProperty();
				aData.push(oNode);
			}
			// Call Unpack HU
			this._unpackHU(aData);
		},

		onPackButtonPress: function (oEvent) {
			var oPackTable = this.byId("idPackProposalTab");
			var oUnPackTable = this.byId("idUnPackProposalTab");
			var aSelectedIndices = oPackTable.getSelectedIndices();
			var aSelectedUnpackItems = oUnPackTable.getSelectedItems();
			var aData = [];

			if (aSelectedIndices.length === 0 || aSelectedUnpackItems.length === 0) {
				MessageToast.show("Select at least one row first.");
				return;
			} else if (aSelectedIndices.length > 1) {
				MessageToast.show(this.oBundle.getText("actionPackNotPossibleForMultiSelect"));
				return;
			}
			var oContext = oPackTable.getContextByIndex(aSelectedIndices[0]);
			var oNode = oContext.getProperty();
			if (!oNode.Exidv) {
				MessageToast.show(this.oBundle.getText("actionPackNotPossibleForMultiSelect"));
				return;
			}
			for (var i = 0; i < aSelectedUnpackItems.length; i++) {
				aData.push(aSelectedUnpackItems[i].getBindingContext("global").getObject());
			}
			// Call Unpack HU
			this._packHU(oNode.NodeId, aData);
		},

		// Add New HU section
		onAddNewHU: function () {
			this._getDefaultHU();
		},

		onCloseNewHUDialog: function () {
			this.oDialogNewHU.close();
		},

		onCreateHU: function () {
			this._createHU();
		},

		onPackMatValueRequested: function () {
			var oPackMatDlg = Utils.getFragment("", "PackMatDialog", this);
			oPackMatDlg.open();
		},

		onPackMatValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilterID = new Filter("Matnr", sap.ui.model.FilterOperator.Contains, sValue);
			var oFilterValue = new Filter("Maktx", sap.ui.model.FilterOperator.Contains, sValue);
			var oAllFilter = new Filter([oFilterID, oFilterValue], false);

			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oAllFilter]);
		},

		onPackMatConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oPackMat = this.byId("txtPackMat");
				oPackMat.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onPackMatValueHelpClose: function (oEvent) {
			oEvent.getSource().getBinding("items").filter([]);
		},

		onDeleteHU: function (oEvent) {
			var aDeletedHUs = this._getSelectedHUs();
			var isValid = true;
			if (aDeletedHUs.length === 0) {
				MessageBox.error("Please select at lest one HU to continue!");
				return;
			}
			aDeletedHUs.forEach(function (item) {
				if (item.ParentId) {
					MessageBox.error(this.oBundle.getText("errorDeleteMaterial"));
					isValid = false;
					return;
				}
			}.bind(this));
			if (!isValid) {
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmDeleteHUMessage"), {
				title: this.oBundle.getText("ConfirmDeletion"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteHUs(aDeletedHUs, false);
					}
				}.bind(this)
			});
		},

		onDeleteAllHU: function () {
			MessageBox.confirm(this.oBundle.getText("confirmDeleteAllHUMessage"), {
				title: this.oBundle.getText("ConfirmDeletion"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteHUs([], true);
					}
				}.bind(this)
			});
		},

		onNavigateToExternal: function (oEvent) {
			var sHref =
				"https:\\//s4hd6.erp-is.com:8001/sap/bc/ui5_ui5/ui2/ushell/shells/abap/FioriLaunchpad.html?sap-client=400&sap-language=EN#ZSO-changeSO?SalesOrder=" +
				this.sSalesNo;
			window.open(
				sHref,
				"_blank"
			);
		},
		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_deleteHUs: function (aDeletedHUs, bAll) {
			var oRequestData = this._generateDeleteHUUsecase(aDeletedHUs, bAll);
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					this._successPackingProposal(oData);
					this.hideBusy();
					MessageToast.show(this.oBundle.getText("DeleteHUSuccess"));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateDeleteHUUsecase: function (aDeletedHUs, bAll) {
			var selectedShipset = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			var i;
			// delete all
			if (bAll) {
				for (i = 0; i < selectedShipset.PackingProposalSet.results.length; i++) {
					if (selectedShipset.PackingProposalSet.results[i].Exidv) {
						selectedShipset.PackingProposalSet.results[i].Sel = true;
					}
				}
			} else {
				aDeletedHUs.forEach(function (item) {
					for (i = 0; i < selectedShipset.PackingProposalSet.results.length; i++) {
						if (selectedShipset.PackingProposalSet.results[i].NodeId === item.NodeId && selectedShipset.PackingProposalSet.results[i].Sel ===
							false) {
							selectedShipset.PackingProposalSet.results[i].Sel = true;
						}
					}
				});
			}

			var aUnPackItemSet = this.getModel("global").getProperty("/UnPackItemSet");
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "DeletePack",
				ShipSetSet: [selectedShipset],
				UnPackItemSet: aUnPackItemSet
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},
		_getSelectedHUs: function () {
			var oPackTable = this.byId("idPackProposalTab");
			var aSelectedIndices = oPackTable.getSelectedIndices();
			var aResults = [];
			for (var i = 0; i < aSelectedIndices.length; i++) {
				var oContext = oPackTable.getContextByIndex(aSelectedIndices[i]);
				var oNode = oContext.getProperty();
				if (oNode.Exidv) {
					aResults.push(oContext.getObject());
				}
			}
			return aResults;
		},

		_getDefaultHU: function () {
			this.showBusy();
			var selectedShipset = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			this.getModel().callFunction("/GetDefaultHU", {
				urlParameters: {
					Vbeln: this.sSalesNo,
					Vstel: selectedShipset.Vstel,
					Carrier: selectedShipset.Carrier
				},
				success: function (oData) {
					this.oDialogNewHU = Utils.getFragment(null, "CreateHUDialog", this);
					oData.Breit = parseFloat(oData.Breit, [10]);
					oData.Hoehe = parseFloat(oData.Hoehe, [10]);
					oData.Laeng = parseFloat(oData.Laeng, [10]);
					this.getModel("global").setProperty("/defaultAddHU", oData);
					this.oDialogNewHU.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.oDialogNewHU.close();
					this.hideBusy();
				}.bind(this)
			});
		},

		_createHU: function () {
			var oNewHU = this.getModel("global").getProperty("/defaultAddHU");
			oNewHU.Breit = oNewHU.Breit.toString();
			oNewHU.Hoehe = oNewHU.Hoehe.toString();
			oNewHU.Laeng = oNewHU.Laeng.toString();

			var oRequestData = this._generateAddProposalUsecase(oNewHU);

			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					this._successPackingProposal(oData);
					var bKeepDialog = this.byId(this.createId("idAddNextItemHU")).getSelected();
					if (!bKeepDialog) {
						this.oDialogNewHU.close();
					}
					MessageToast.show(this.oBundle.getText("CreateHUSuccess"));
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.oDialogNewHU.close();
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateAddProposalUsecase: function (oNewHU) {
			var oUnPackTable = this.byId("idUnPackProposalTab");

			var aSelectedUnpackItems = oUnPackTable.getSelectedItems();
			var aData = [];
			for (var i = 0; i < aSelectedUnpackItems.length; i++) {
				aData.push(aSelectedUnpackItems[i].getBindingContext("global").getObject());
			}
			var selectedShipset = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			var aUnPackItemSet = this.getModel("global").getProperty("/UnPackItemSet");

			var oData = {
				Vbeln: this.sSalesNo,
				Action: "AddPack",
				PopupData: oNewHU,
				ShipSetSet: [selectedShipset],
				UnPackItemSet: aUnPackItemSet
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_packHU: function (oHUId, aItems) {
			this.showBusy();
			var oRequestData = this._generatePackProposalUsecase(oHUId, aItems);
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					this._successPackingProposal(oData);

					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePackProposalUsecase: function (oHUId, aUnpackItems) {
			var selectedShipset = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			var aUnPackItemSet = this.getModel("global").getProperty("/UnPackItemSet");
			var i;
			for (i = 0; i < selectedShipset.PackingProposalSet.results.length; i++) {
				if (selectedShipset.PackingProposalSet.results[i].NodeId === oHUId) {
					selectedShipset.PackingProposalSet.results[i].Sel = true;
					break;
				}
			}
			for (i = 0; i < aUnpackItems.length; i++) {
				for (var j = 0; j < aUnPackItemSet.results.length; j++) {
					if (aUnPackItemSet.results[j].Posnr === aUnpackItems[i].Posnr &&
						aUnPackItemSet.results[j].Matnr === aUnpackItems[i].Matnr &&
						aUnPackItemSet.results[j].Sel === false) {
						aUnPackItemSet.results[j].Sel = true;
						break;
					}
				}
			}
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "Pack",
				ShipSetSet: [selectedShipset],
				UnPackItemSet: aUnPackItemSet
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_unpackHU: function (aItems) {
			this.showBusy();
			var oRequestData = this._generateUnpackProposalUsecase(aItems);
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					this._successPackingProposal(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},

		_generateUnpackProposalUsecase: function (aUnpackItems) {
			var selectedShipset = this.oShipsetTab.getSelectedItem().getBindingContext("global").getObject();
			var j = 0;
			for (var i = 0; i < aUnpackItems.length; i++) {
				if (aUnpackItems[i].Children.length > 0) {
					for (var k = 0; k < aUnpackItems[i].Children.length; k++) {
						for (j = 0; j < selectedShipset.PackingProposalSet.results.length; j++) {
							if (selectedShipset.PackingProposalSet.results[j].NodeId === aUnpackItems[i].Children[k].NodeId) {
								selectedShipset.PackingProposalSet.results[j].Sel = true;
							}
						}
					}
				}
				for (j = 0; j < selectedShipset.PackingProposalSet.results.length; j++) {
					if (selectedShipset.PackingProposalSet.results[j].NodeId === aUnpackItems[i].NodeId &&
						selectedShipset.PackingProposalSet.results[j].Sel === false) {
						selectedShipset.PackingProposalSet.results[j].Sel = true;
						break;
					}
				}
			}
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "UnPack",
				ShipSetSet: [selectedShipset],
				UnPackItemSet: this.getModel("global").getProperty("/UnPackItemSet")
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_copyObject: function (oTarget, oSource) {
			for (var property in oTarget) {
				if (property === "__metadata") {
					continue;
				}
				if (oTarget.hasOwnProperty(property) && oSource.hasOwnProperty(property) && oSource[property] !== "") {
					if (typeof (oTarget[property]) === "object") {
						this._copyObject(oTarget[property], oSource[property]);
					} else {
						oTarget[property] = oSource[property];
					}

				}
			}
		},

		_generateValidateAddressUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "AddressValidation",
				SOActive: this.getModel("global").getProperty("/SOActive"),
				ShipSetSet: this.getModel("global").getProperty("/ShipSetSet"),
				AddressOriginal: {},
				AddressNew: {}
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_syncPackproposalData: function () {
			var treeData = jQuery.extend(true, [], this.getModel("global").getProperty("/PackingOverviewList"));
			var sSelectedShipsetPath = this.oShipsetTab.getSelectedItem().getBindingContext("global").getPath();
			var sPath = sSelectedShipsetPath + "/PackingProposalSet";
			var oPackProposalDest = this.getModel("global").getProperty(sPath);
			var fTotalWeight = 0;

			treeData.forEach(function (item) {
				for (var i = 0; i < oPackProposalDest.results.length; i++) {
					if (oPackProposalDest.results[i].NodeId === item.NodeId) {
						delete item.Children;
						// copy data 
						jQuery.extend(true, oPackProposalDest.results[i], item);
						break;
					}
				}
				fTotalWeight += parseFloat(item.Brgew);
			}.bind(this));
			var oFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
				decimals: 3
			});
			this.getModel("global").setProperty(sSelectedShipsetPath + "/Brgew", oFormat.format(fTotalWeight));
			// sync data
			this.getModel("global").setProperty(sPath, oPackProposalDest);
		},

		_resetProposal: function () {
			var fTotalWeight = 0;
			var oContext = this.oShipsetTab.getSelectedItem().getBindingContext("global");
			var sPath = oContext.getPath();
			var oProposalOrigin = this.getModel("global").getProperty("/PackingProposalOrigin") || {
				results: []
			};
			var aUnpackItemSetOrigin = this.getModel("global").getProperty("/UnPackItemSetOrigin");
			this.getModel("global").setProperty("/UnPackItemSet", aUnpackItemSetOrigin);

			var aOutput = [];
			try {
				var aResults = jQuery.extend(true, [], oProposalOrigin.results);
				aOutput = this.treeify(aResults, "NodeId", "ParentId");
				// This json node is used to bind the tree table
				var oStorePackingProposal = this.getModel("global").getProperty("/StorePackingProposal");
				oStorePackingProposal[oContext.getObject().Counter.trim()] = aOutput;
				this.getModel("global").setProperty("/StorePackingProposal", oStorePackingProposal);
				// Update back the selected shipset
				this.getModel("global").setProperty(sPath + "/PackingProposalSet", oProposalOrigin);

				// reset weight.
				aOutput.forEach(function (item) {
					fTotalWeight += parseFloat(item.Brgew);
				}.bind(this));
				var oFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
					decimals: 3
				});
				this.getModel("global").setProperty(sPath + "/Brgew", oFormat.format(fTotalWeight));
			} catch (ex) {
				MessageBox.warning("There is no packing proposal data");
			}
		},

		_getPackProposal: function (oObject) {
			// If the PackingProposal is already loaded, will not call the usecase
			var oStorePackingProposal = this.getModel("global").getProperty("/StorePackingProposal") || {};
			if (oStorePackingProposal[oObject.Counter.trim()]) {
				this.getModel("global").setProperty("/PackingOverviewList", oStorePackingProposal[oObject.Counter.trim()]);
				this.oPackProposalDialog = Utils.getFragment(null, "PackingProposalDialog", this);
				this.oPackProposalDialog.open();
				return;
			}

			var oRequestData = this._generateGetPackProposalUsecase(oObject);
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					// store original data.
					var oUnpackItemOrigin = jQuery.extend(true, {}, oData.UnPackItemSet);
					if (!oUnpackItemOrigin.results) {
						oUnpackItemOrigin.results = [];
					}
					this.getModel("global").setProperty("/PackingProposalOrigin", jQuery.extend(true, {}, oData.ShipSetSet.results[0].PackingProposalSet));
					this.getModel("global").setProperty("/UnPackItemSetOrigin", oUnpackItemOrigin);

					this._successPackingProposal(oData);
					this.oPackProposalDialog = Utils.getFragment(null, "PackingProposalDialog", this);
					this.oPackProposalDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateGetPackProposalUsecase: function (oObject) {
			oObject.PackingProposalSet = [];
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "PackProposal",
				UnPackItemSet: [],
				ShipSetSet: [oObject]
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
					this._overwriteCommonSOFlatStructure(oData);

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
				Vbeln: this.sSalesNo,
				Action: "GetSingleFreightCost",
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
				oData.Action = "GetSingleFreightCost";
			} else if (sScenario === "O") {
				oData.Action = "GetOptimizationFreightCost";
			} else {
				oData.Action = "GetShopFreightCost";
			}
			return oData;
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

						sap.ui.getCore().getEventBus().publish("RATE_QUOTE_SELECTION", {});
					} catch (exc) {
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
				Vbeln: this.sSalesNo,
				Action: "SetRateQuote",
				ShipSetSet: [oShipset],
				RatesSet: [oRate]
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_getShipsets: function () {
			var oRequestData = this._generateGetShipsetUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					if (oData.CarrierListSet) {
						this.getModel("global").setProperty("/CarrierListSet", oData.CarrierListSet.results);
					} else {
						this.getModel("global").setProperty("/CarrierListSet", []);
					}
					if (oData.SOActive) {
						this.getModel("global").setProperty("/SOActive", oData.SOActive);
					} else {
						this.getModel("global").setProperty("/SOActive", {});
					}
					if (oData.AddrVal) {
						this.getModel("global").setProperty("/AddrVal", oData.AddrVal);
					} else {
						this.getModel("global").setProperty("/AddrVal", {});
					}
					if (oData.ServiceListSet) {
						this.getModel("global").setProperty("/ServiceListSet", oData.ServiceListSet.results);
					} else {
						this.getModel("global").setProperty("/ServiceListSet", []);
					}
					if (oData.ShipSetSet) {
						var aShipsetResults = oData.ShipSetSet.results;
						for (var i = 0; i < aShipsetResults.length; i++) {
							if (!aShipsetResults[i].ShipSetItemSet) {
								aShipsetResults[i].ShipSetItemSet = [];
							}
						}
						this.getModel("global").setProperty("/ShipSetSet", aShipsetResults);
						this.getModel("global").setProperty("/ShipSetSetOriginal", jQuery.extend(true, [], aShipsetResults));
					} else {
						this.getModel("global").setProperty("/ShipSetSet", []);
						this.getModel("global").setProperty("/ShipSetSetOriginal", []);
					}

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

		_generateGetShipsetUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "ShipsetDetermination",
				CarrierListSet: [],
				ServiceListSet: [],
				ShipSetSet: [{
					ShipSetItemSet: []
				}],
				SOActive: {},
				AddrVal: {},
				// New Structure
				Vbak: {},
				VbapvbSet: [],
				VbepvbSet: [],
				VbfavbSet: [],
				Vbkd: {},
				VbkdvbSet: [],
				VbpavbSet: [],
				VbupvbSet: [],
				SadrvbSet: [],
				ShipSetCommonSet: [],
				TrackproShipSetKeyCommonSet: [],
				MoreoptCommonSet: [{
					ValueListMoreoptCommonSet: []
				}],
				TrackproVerkoCommonSet: [],
				TrackproVerpoCommonSet: [],
				TrackproPackHUdataCommonSet: [],
				TrackproPackItmdataCommonSet: []
			};
			return oData;
		},

		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObjectDetail: function (oItem) {
			var bReplace = !Device.system.phone;
			// set the layout property of FCL control to show two columns
			this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");

			this.getModel("global").setProperty("/selectedShipsetPath", oItem.getBindingContextPath());
			this.getRouter().navTo("objectDetail", {
				SalesNo: this.sSalesNo,
				Counter: oItem.getBindingContext("global").getObject().Counter.trim()
			}, bReplace);
		},

		_successPackingProposal: function (oData) {
			// Overwrite original Packing proposal active flag
			this._updateOriginalPackingProposalActive(oData);

			// Build lower table
			this.getModel("global").setProperty("/UnPackItemSet", (oData.UnPackItemSet) ? oData.UnPackItemSet : {
				results: []
			});

			// Build upper table json node for display
			if (!oData.ShipSetSet.results[0].PackingProposalSet) {
				oData.ShipSetSet.results[0].PackingProposalSet = {
					results: []
				};
			}
			var aResults = jQuery.extend(true, [], oData.ShipSetSet.results[0].PackingProposalSet.results);
			var aOutput = this.treeify(aResults, "NodeId", "ParentId");
			var oStorePackingProposal = this.getModel("global").getProperty("/StorePackingProposal") || {};
			// This json node is used to bind the tree table
			this.getModel("global").setProperty("/PackingOverviewList", aOutput);
			// Store packing proposal
			oStorePackingProposal[oData.ShipSetSet.results[0].Counter.trim()] = aOutput;
			this.getModel("global").setProperty("/StorePackingProposal", oStorePackingProposal);
			// Update back Packproposal node on the selected shipset
			var sPath = this.oShipsetTab.getSelectedItem().getBindingContext("global").getPath();
			this.getModel("global").setProperty(sPath + "/PackingProposalSet", oData.ShipSetSet.results[0].PackingProposalSet);
			// To store the new common flat sales order structure
			this._overwriteCommonSOFlatStructure(oData);
		}

	});
});