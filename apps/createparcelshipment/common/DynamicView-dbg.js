sap.ui.define(["sap/ui/layout/form/SimpleForm", "com/erpis/shiperp/createparcelshipment/common/ControlUtils",
	"com/erpis/shiperp/createparcelshipment/common/Utils"
], function (SimpleForm, ControlUtils, Utils) {
	"use strict";
	return {
		/**Render dynamic fields for more option view package level
		 * */
		renderMoreOptionForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oDataOld = aSourceFields;
				var oMoreOptionForm = this.renderMoreOptionFormContent(aSourceFields, oController, bDeep, false, oDataOld);
				oController.oMoreOptionDialog.addContent(oMoreOptionForm);
			}
		},
		/**
		 * render form for shipment level
		 **/
		renderShipmentCarrierOptionForm: function (aSourceFields, oController, bDeep) {
			var oDataOld = aSourceFields;
			if (aSourceFields.length > 0) {
				var oShipmentMoreOptionForm = this.renderMoreOptionFormContent(aSourceFields, oController, bDeep, true, oDataOld);
				oController.oShipmentCarrierOptionTab.addBlock(oShipmentMoreOptionForm);
			}
		},
		/**
		 * @param: bShipment - true is for shipment level; false for package level
		 * */
		renderMoreOptionFormContent: function (aOriginalSourceFields, oController, bDeep, bShipment, oDataOld) {
			oController.aTable = [];
			var aSourceFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", "");
			// var aRootFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", "");
			// var aSourceFields = Utils._removeDuplicateObjInArr(aRootFields, "FieldName"); //remove duplicate record prevent dup items on UI
			this.bcheckTableMoreOption = false;
			//check deep items
			if (bDeep === true) {
				aSourceFields = aOriginalSourceFields;
			}
			if (aSourceFields.length > 0) {
				var oMoreOptionForm = new SimpleForm({
					width: "auto",
					editable: true,
					layout: "ResponsiveGridLayout",
					labelSpanXL: 6,
					labelSpanL: 6,
					labelSpanM: 6,
					labelSpanS: 4,
					columnsXL: 4,
					columnsL: 4,
					columnsM: 3
				}).addStyleClass("border_lightgray sapUiSmallMarginBottom");
				var sFieldGroup = "";
				for (var i = 0; i < aSourceFields.length; i++) {
					if (aSourceFields[i].FieldGroup !== sFieldGroup && aSourceFields[i].Sequence === "01") {
						var oTitle = new sap.ui.core.Title({
							text: aSourceFields[i].GroupText
						});
						oMoreOptionForm.addContent(oTitle);
						sFieldGroup = aSourceFields[i].FieldGroup;
					}
					if (aSourceFields[i].CarrCode === "" || aSourceFields[i].FieldName === "") {
						continue;
					}
					var oLabel = ControlUtils.Label(aSourceFields[i].FieldDesc);
					if (aSourceFields[i].FieldType !== "08") {
						oMoreOptionForm.addContent(oLabel);
					}

					//Build dynamic fields
					var thisInstance = this;
					var oSourceField = Object.assign({}, aSourceFields[i]);
					oSourceField.ComboboxValues = (aSourceFields[i].value_list) ? aSourceFields[i].value_list.results : []; //set data for combobox
					//Add event for checkbox if FieldValue2 not null
					if (aSourceFields[i].FieldType === "02" && aSourceFields[i].FieldValue2 !== "") {
						//add checkbox event to enable disable button
					}
					//Field type button event handler
					if (aSourceFields[i].FieldType === "08") {
						oSourceField.FnCallback = function (data) {
							var aDeepFields;
							var oMoreOptionChild;
							if (aOriginalSourceFields.length === oDataOld.length) {
								aDeepFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderMoreOptionFormContent(aDeepFields, oController, true, bShipment);
									thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							} else {
								aDeepFields = Utils._getExistItemsArray(oDataOld, "FieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderMoreOptionFormContent(aDeepFields, oController, true, bShipment);
									thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							}

						};
						// 	var aDeepFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", data.key);
						// 	if (aDeepFields.length > 0) {
						// 		thisInstance.isShipment = bShipment;
						// 		var oMoreOptionChild = thisInstance.renderMoreOptionFormContent(aDeepFields, oController, true, bShipment);
						// 		thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
						// 	}
						// };
					}

					var oFieldBase = ControlUtils.BuildControlByType(oSourceField, oController);
					// Disable option before add to content
					if (aSourceFields[i].DisplayOption === "1" || aSourceFields[i].DisplayOption === "2") {
						if (aSourceFields[i].DisplayOption === "2") {
							oLabel.setRequired(true);
						} else {
							oLabel.setRequired(false);
						}
						if (aSourceFields[i].FieldType === "10") {
							oFieldBase.setVisible(false);
						} else {
							oFieldBase.setEnabled(true);
						}
					} else {
						//Axo 6913
						oFieldBase.setEnabled(false);
					}
					//Axo 4770
					if (oController.isCanShip === false) {
						oFieldBase.setEnabled(false);
					}
					oFieldBase.setWidth("auto");
					oMoreOptionForm.addContent(oFieldBase);
					//dynmaic Table
					if (aSourceFields[i].FieldValue2 !== "") {
						if (aSourceFields[i].FieldValue2.column.length > 0) {
							this.bcheckTableMoreOption = true;
							var aData = aSourceFields[i].FieldValue2;

							var aDataSearchHelp = aSourceFields[i].Searchhelp;
							var columns = aData.column.map(function (column) {
								var key = Object.keys(column)[0];
								var disabled = column.disable || false;
								return {
									label: column[key],
									property: key,
									disabled: disabled
								};
							});
							var oTable = new sap.m.Table({
								width: "100%",
								columns: columns.map(function (column) {
									return new sap.m.Column({
										header: new sap.m.Text({
											text: column.label
										})
									});
								})
							});
							oController.aTable.push(oTable);
							aData.value.forEach(function (obj, index) {
								var oRow = new sap.m.ColumnListItem();
								columns.forEach(function (column) {
									var value = obj[column.property];
									var cell;
									if (typeof value === "string") {
										cell = new sap.m.Input({
											value: value,
											name: column.property,
											editable: !column.disabled,
											valueHelpOnly: true,
											showValueHelp: true,
											valueHelpRequest: function (oEvent) {
												oController._FieldSourceCarrierOption = oEvent.getSource();
												this.oF4PackageLevelDlg = thisInstance.buildF4DialogPackageLevel(oEvent, oController, aDataSearchHelp);
												this.oF4PackageLevelDlg.open();
											},
										});
									} else if (typeof value === 'undefined') {
										cell = new sap.m.Text({
											text: ''
										});
									}
									oRow.addCell(cell);
								});

								oTable.addItem(oRow);
							});
							// Add a search field to the table
							var oSearchField = new sap.m.SearchField({
								placeholder: "Search...",
								width: "30rem",
								liveChange: function (oEvent) {
									var sValue = oEvent.getParameter("newValue").toLowerCase();
									var aItems = oTable.getItems();
									for (var i = 0; i < aItems.length; i++) {
										var aCells = aItems[i].getCells();
										var bMatchFound = false;
										for (var j = 0; j < aCells.length; j++) {
											var sCellText = "";
											if (aCells[j] instanceof sap.m.Input) {
												sCellText = aCells[j].getValue().toLowerCase();
											} else if (aCells[j] instanceof sap.m.Text) {
												sCellText = aCells[j].getText().toLowerCase();
											}
											if (sCellText.indexOf(sValue) !== -1) {
												bMatchFound = true;
												break;
											}
										}
										aItems[i].setVisible(bMatchFound);
									}
								}
							}).addStyleClass("sapUiTinyMarginEnd");
							var oToolbarSpacer = new sap.m.ToolbarSpacer();
							//title to the table
							var oTitle = new sap.m.Title({
								text: aSourceFields[i].FieldDesc,
								level: sap.ui.core.TitleLevel.H2,
							});
							//toolbar to the table
							var oToolbar = new sap.m.Toolbar({
								content: [oTitle, oToolbarSpacer, oSearchField]
							});
							var aToolbar = [oToolbar];
							oController.aTable.forEach(function (table) {
								aToolbar.push(table)
							})
							var oVBoxTable = new sap.m.VBox({
								items: aToolbar
							});
						}
					}
				} //end loop

				if (this.bcheckTableMoreOption) {
					var oContainer = new sap.m.FlexBox({
						direction: "Column",
						items: [
							oMoreOptionForm,
							oVBoxTable
						]
					});
					return oContainer;
				} else {
					return oMoreOptionForm;
				} // return the VBox instead of the SimpleForm
			}
			return null;
		},
		renderDialog: function (oContent, deepId, sTitle, oController, oDynamicInstance) {

			//remove old dialog to avoid duplicate
			if (oController._deepFormDialog) {
				oController._deepFormDialog.destroy();
				oController._deepFormDialog = null;
			}
			//create new dialog
			oController._deepFormDialog = new sap.m.Dialog({
				id: deepId,
				title: sTitle,
				content: oContent,
				state: "Success",
				stretch: true,
				endButton: new sap.m.Button({
					text: "Close",
					press: function () {
						if (oController._deepFormDialog.getContent()[0]) {
							oDynamicInstance.getDynamicDataForDialog(oController._deepFormDialog, oController, oDynamicInstance, false);
						}
						oController._deepFormDialog.close();
						oController._deepFormDialog.destroy();
					}
				})
			});
			oController.getView().addDependent(oController._deepFormDialog);
			oController._deepFormDialog.open();

		},
		//get dynamic data for package level
		getDynamicDataForDialog: function (oDialogInstance, oController, oDynamicInstance, isDeep) {

			if (oDialogInstance === null) {
				return;
			}
			var aControls;
			if (oDialogInstance.getContent()[0]) {
				if (oDialogInstance.getContent()[0] instanceof sap.m.FlexBox) {
					aControls = oDialogInstance.getContent()[0].getItems()[0].getContent();
				} else {
					aControls = oDialogInstance.getContent()[0].getContent();
				}
				if (aControls.length > 0) {
					if (!oDynamicInstance.isShipment) {
						//for package level
						if (!oController.currentFUPath) {
							return;
						}
						var oFreightUnitItemRow = oController.getModel("local").getProperty(oController.currentFUPath);
						for (var i = 0; i < aControls.length; i++) {
							if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataFromDynamicControl(aControls[i], oFreightUnitItemRow, "PACKAGE");
							}
						}

						oController.getModel("local").setProperty(oController.currentFUPath, oFreightUnitItemRow);
					} else {
						//for shipment level
						var oShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
						for (var s = 0; s < aControls.length; s++) {
							if (!(aControls[s] instanceof sap.m.Button || aControls[s] instanceof sap.m.Label || aControls[s] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataFromDynamicControl(aControls[s], oShipmentCarrierOptions, "SHIPMENT");
							}
						}

						oController.getModel("local").setProperty("/ShipmentCarrierOptions", oShipmentCarrierOptions);

					}

				}
			}
		},

		//get dynamic data for shipment level
		getDynamicDataForShipmentCarrierOptionForm: function (oForm, oController, oDynamicInstance) {

			if (oForm.getContent()[0]) {
				var aControls = oForm.getContent();
				if (aControls.length > 0) {
					var oShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
					for (var i = 0; i < aControls.length; i++) {
						if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
							oDynamicInstance._getDataFromDynamicControl(aControls[i], oShipmentCarrierOptions, "SHIPMENT");
						}
					}

					oController.getModel("local").setProperty("/ShipmentCarrierOptions", oShipmentCarrierOptions);
				}
			}
		},

		_getDataFromDynamicControl: function (oControl, oSource, sLevel) {
			var sFieldName = oControl.getId(),
				sValue1 = "",
				sValue2 = "";
			//remove prefix
			sFieldName = sFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");

			if (oControl instanceof sap.m.CheckBox) {
				sValue1 = oControl.getSelected() ? "X" : "";
			} else if (oControl instanceof sap.m.ComboBox) {
				sValue1 = oControl.getSelectedKey();
			} else if (oControl instanceof sap.m.Input) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.DateRangeSelection) {
				var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyyMMdd"
				});
				sValue1 = dateFormat.format(oControl.getDateValue());
				sValue2 = dateFormat.format(oControl.getSecondDateValue());
			} else if (oControl instanceof sap.m.DatePicker) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.RadioButton) {
				sValue1 = oControl.getSelected();
			} else if (oControl instanceof sap.m.TimePicker) {
				sValue1 = oControl.getValue();
			}
			this._updateMoreOptionData(oSource, sFieldName, sValue1, sValue2, sLevel);
		},
		_updateMoreOptionData: function (oSource, sFieldName, sValue1, sValue2, sLevel) {
			if (!sFieldName) {
				return;
			}
			//process for package
			if (sLevel === "PACKAGE") {
				for (var i = 0; i < oSource.carrier_more_option.results.length; i++) {
					var packageFieldName = oSource.carrier_more_option.results[i].FieldName;
					packageFieldName = packageFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (packageFieldName === sFieldName) {
						oSource.carrier_more_option.results[i].FieldValue1 = sValue1;
						// oSource.carrier_more_option.results[i].FieldValue2 = sValue2;
						break;
					}
				}

			}

			//process for shipment
			if (sLevel === "SHIPMENT") {
				for (var s = 0; s < oSource.length; s++) {
					var shipmentFieldName = oSource[s].FieldName;
					shipmentFieldName = shipmentFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (shipmentFieldName === sFieldName) {
						oSource[s].FieldValue1 = sValue1;
						// oSource[s].FieldValue2 = sValue2;
						break;
					}
				}
			}
		},
		removePrefixBeforeExecute: function (aSources) {
			aSources.forEach(function (item) {
				item.FieldName = item.FieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
			});
			return aSources;
		},
		removePrefixPackage: function (oController) {
			var aFreightUnits = oController.getModel("local").getProperty("/Freightunits");
			var oThis = this;
			aFreightUnits.forEach(function (fuItem) {
				fuItem.carrier_more_option.results = oThis.removePrefixBeforeExecute(fuItem.carrier_more_option.results);
			});
			oController.getModel("local").setProperty("/Freightunits", aFreightUnits);
		},
		removePrefixShipment: function (oController) {
			var aShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
			aShipmentCarrierOptions = this.removePrefixBeforeExecute(aShipmentCarrierOptions);
			oController.getModel("local").setProperty("/ShipmentCarrierOptions", aShipmentCarrierOptions);

		},
		/**
		 * handle dynamic Hazmat options
		 * */
		renderHazmatOptionForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oShipmentMoreOptionForm = this.renderOptionsFormContent(aSourceFields, oController, bDeep, true);
				oController.oHazmatOptions.addContent(oShipmentMoreOptionForm);
			}
		},

		renderOptionsFormContent: function (aOriginalSourceFields, oController, bDeep, bShipment) {
			oController.aTableHazmat = []
			var aSourceFields = Utils._removeDuplicateObjInArr(aOriginalSourceFields, "field_name"); //remove duplicate record prevent dup items on UI
			this.bcheckTable = false;
			//check deep items
			if (bDeep === true) {
				aSourceFields = aOriginalSourceFields;
			}
			if (aSourceFields.length > 0) {
				// create dynamic SimpleForm
				var oMoreOptionFormHazmat = new SimpleForm({
					width: "auto",
					editable: true,
					layout: "ResponsiveGridLayout",
					labelSpanXL: 6,
					labelSpanL: 6,
					labelSpanM: 6,
					labelSpanS: 4,
					columnsXL: 4,
					columnsL: 4,
					columnsM: 3
				}).addStyleClass("border_lightgray sapUiSmallMarginBottom");

				var sFieldGroup = "";
				for (var i = 0; i < aSourceFields.length; i++) {
					if (aSourceFields[i].FieldGroup !== sFieldGroup && aSourceFields[i].Sequence === "01") {
						var oTitle = new sap.ui.core.Title({
							text: aSourceFields[i].GroupText
						});
						oMoreOptionFormHazmat.addContent(oTitle);
						sFieldGroup = aSourceFields[i].FieldGroup;
					}
					if (aSourceFields[i].CarrierId === "" || aSourceFields[i].FieldName === "") {
						continue;
					}
					var oLabel = ControlUtils.Label(aSourceFields[i].FieldDesc);
					if (aSourceFields[i].FieldType !== "08") {
						oMoreOptionFormHazmat.addContent(oLabel);
					}
					//Build dynamic fields
					var thisInstance = this;
					var oSourceField = Object.assign({}, aSourceFields[i]);
					oSourceField.ComboboxValues = (aSourceFields[i].value_list) ? aSourceFields[i].value_list.results : []; //set data for combobox
					//Add event for checkbox if fieldValue not null
					if (aSourceFields[i].FieldType === "02" && aSourceFields[i].FieldValue1 !== "") {
						//add checkbox event to enable disable button
					}
					var oFieldBase = ControlUtils.BuildControlHazmatByType(oSourceField, oController);
					// Disable option before add to content
					if (aSourceFields[i].DisplayOption === "1" || aSourceFields[i].DisplayOption === "2") {
						if (aSourceFields[i].DisplayOption === "2") {
							oLabel.setRequired(true);
						} else {
							oLabel.setRequired(false);
						}
						if (aSourceFields[i].FieldType === "10") {
							oFieldBase.setVisible(false);
						} else {
							oFieldBase.setEnabled(true);
						}
					} else {
						oFieldBase.setEnabled(false);
					}
					if (oController.isCanShip === false) {
						oFieldBase.setEnabled(false);
					}
					oFieldBase.setWidth("auto");
					oMoreOptionFormHazmat.addContent(oFieldBase);
					//dynmaic Table hazmat
					if (aSourceFields[i].FieldType === "10") {
						if (aSourceFields[i].FieldValue2.column.length > 0) {
							this.bcheckTableMoreOption = true;
							var aData = aSourceFields[i].FieldValue2;
							var aDataSearchHelp = aSourceFields[i].Searchhelp;
							var columns = aData.column.map(function (column) {
								var key = Object.keys(column)[0];
								var disabled = column.disable || false;
								return {
									label: column[key],
									property: key,
									disabled: disabled
								};
							});
							var oTable = new sap.m.Table({
								width: "100%",
								columns: columns.map(function (column) {
									return new sap.m.Column({
										header: new sap.m.Text({
											text: column.label
										})
									});
								})
							});
							oController.aTableHazmat.push(oTable);
							aData.value.forEach(function (obj, index) {
								var oRow = new sap.m.ColumnListItem();
								columns.forEach(function (column) {
									var value = obj[column.property];
									var cell;
									if (typeof value === "string") {
										cell = new sap.m.Input({
											value: value,
											name: column.property,
											editable: !column.disabled,
											valueHelpOnly: true,
											showValueHelp: true,
											valueHelpRequest: function (oEvent) {
												oController._FieldSourceCarrierOption = oEvent.getSource();
												this.oF4PackageLevelDlg = thisInstance.buildF4DialogPackageLevel(oEvent, oController, aDataSearchHelp);
												this.oF4PackageLevelDlg.open();
											},
										});
									} else if (typeof value === 'undefined') {
										cell = new sap.m.Text({
											text: ''
										});
									}
									oRow.addCell(cell);
								});

								oTable.addItem(oRow);
							});
							// Add a search field to the table
							var oSearchField = new sap.m.SearchField({
								placeholder: "Search...",
								width: "30rem",
								liveChange: function (oEvent) {
									var sValue = oEvent.getParameter("newValue").toLowerCase();
									var aItems = oTable.getItems();
									for (var i = 0; i < aItems.length; i++) {
										var aCells = aItems[i].getCells();
										var bMatchFound = false;
										for (var j = 0; j < aCells.length; j++) {
											var sCellText = "";
											if (aCells[j] instanceof sap.m.Input) {
												sCellText = aCells[j].getValue().toLowerCase();
											} else if (aCells[j] instanceof sap.m.Text) {
												sCellText = aCells[j].getText().toLowerCase();
											}
											if (sCellText.indexOf(sValue) !== -1) {
												bMatchFound = true;
												break;
											}
										}
										aItems[i].setVisible(bMatchFound);
									}
								}
							}).addStyleClass("sapUiTinyMarginEnd");
							var oToolbarSpacer = new sap.m.ToolbarSpacer();
							// title to the table
							var oTitle = new sap.m.Title({
								text: aSourceFields[i].FieldDesc,
								level: sap.ui.core.TitleLevel.H2,
							});
							//toolbar to the table
							var oToolbar = new sap.m.Toolbar({
								content: [oTitle, oToolbarSpacer, oSearchField]
							});
							var aToolbar = [oToolbar];
							oController.aTableHazmat.forEach(function (table) {
								aToolbar.push(table)
							})
							var oVBoxTable = new sap.m.VBox({
								items: aToolbar
							});
						}
					}
				} //end loop
				if (this.bcheckTableMoreOption) {
					var oContainer = new sap.m.FlexBox({
						direction: "Column",
						items: [
							oMoreOptionFormHazmat,
							oVBoxTable
						]
					});
					return oContainer;
				} else {
					return oMoreOptionFormHazmat;
				} // return the VBox instead of the SimpleForm
			}
			return null;
		},

		buildF4DialogPackageLevel: function (oEvent, oController, aDataSearchHelp) {
			var sValue = oEvent.getSource().getName();
			var oObject = aDataSearchHelp.find(function (obj) {
				return Object.keys(obj).some(function (key) {
					return key === sValue;
				});
			});
			var aResult = oObject && oObject.result;
			var oDlgItem = new sap.m.StandardListItem({
				title: "{CarrierOptionF4>Value}",
				description: "{CarrierOptionF4>Description}"

			});
			var oModelF4 = new sap.ui.model.json.JSONModel({
				aList: aResult
			});
			var oDlg = new sap.m.SelectDialog({
				title: "Search Help",
				search: [this.handleF4ValueHelpSearch, this],
				confirm: [this.fnHandleConfirmPackageLevel, oController],
				items: {
					path: "CarrierOptionF4>/aList",
					template: oDlgItem
				}
			});
			oDlg.setModel(oModelF4, "CarrierOptionF4");
			oController.getView().addDependent(oDlg);
			return oDlg;
		},

		fnHandleConfirmPackageLevel: function (event) {
			var oSelectedItem = event.getParameter("selectedItem");
			var aShipmentCarrierOptions = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			if (oSelectedItem) {
				this._FieldSourceCarrierOption.setValue(oSelectedItem.getTitle());
			}
			event.getSource().getBinding("items").filter([]);
			var aItems = this.aTable.getItems();
			var aData = [];
			aItems.forEach(function (oItem) {
				var oCells = oItem.getCells();
				var oRowData = {};
				oCells.forEach(function (oCell) {
					if (oCell instanceof sap.m.Input) {
						var sValue = oCell.getValue();
						var sPropertyName = oCell.getName();
						oRowData[sPropertyName] = sValue;
					} else if (oCell instanceof sap.m.Text) {
						return;
					}

				});
				aData.push(oRowData);
			});
			aShipmentCarrierOptions.forEach(function (item) {
				if (item.FieldValue2 !== "") {
					item.FieldValue2 = Object.assign({}, item.FieldValue2, {
						value: aData
					});
				}
			})

		},

		handleF4ValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new sap.ui.model.Filter("Value", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		getDynamicDataForHazmatOptionForm: function (oForm, oController, oDynamicInstance) {
			if (oForm.getContent().length > 0) {
				if (oForm.getContent()[0]) {
					var aControls = oForm.getContent();
					if (aControls.length > 0) {
						var oShipmentCarrierOptions = oController.getModel("local").getProperty("/BindingHazmatOpt");
						for (var i = 0; i < aControls.length; i++) {
							if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataHazmatFromDynamicControl(aControls[i], oShipmentCarrierOptions, "SHIPMENT");
							}
						}

						oController.getModel("local").setProperty("/BindingHazmatOpt", oShipmentCarrierOptions);
					}
				}
			}

		},
		_getDataHazmatFromDynamicControl: function (oControl, oSource, sLevel) {
			var sFieldName = oControl.getId(),
				sValue1 = "",
				sValue2 = "";
			//remove prefix
			sFieldName = sFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");

			if (oControl instanceof sap.m.ComboBox) {
				sValue1 = oControl.getSelectedKey();
			} else if (oControl instanceof sap.m.Input) {
				sValue1 = oControl.getValue();
			}
			this._updateHazmatData(oSource, sFieldName, sValue1, sValue2, sLevel);
		},
		_updateHazmatData: function (oSource, sFieldName, sValue1, sValue2, sLevel) {
			if (!sFieldName) {
				return;
			}
			//process for package
			if (sLevel === "PACKAGE") {
				for (var i = 0; i < oSource.length; i++) {
					var packageFieldName = oSource[i].FieldName;
					packageFieldName = packageFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (packageFieldName === sFieldName) {
						oSource[i].FieldValue1 = sValue1;
						// oSource.carrier_more_option.results[i].field_value = sValue2;
						break;
					}
				}

			}

			//process for shipment
			if (sLevel === "SHIPMENT") {
				for (var s = 0; s < oSource.length; s++) {
					var shipmentFieldName = oSource[s].FieldName;
					shipmentFieldName = shipmentFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (shipmentFieldName === sFieldName) {
						oSource[s].FieldValue1 = sValue1;
						// oSource[s].field_value = sValue2;
						break;
					}
				}
			}
		},
		/**
		 * handle dynamic international options
		 * */

		renderShipmentInternationalOptionForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oDataOld = aSourceFields;
				var oShipmentMoreOptionForm = this.renderInternationOptionsFormContent(aSourceFields, oController, bDeep, true, oDataOld);
				oController.oShipmentInternationalOptions.addBlock(oShipmentMoreOptionForm);
			}
		},

		renderInternationOptionsFormContent: function (aOriginalSourceFields, oController, bDeep, bShipment, oDataOld) {
			var aRootFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", "");
			var aSourceFields = Utils._removeDuplicateObjInArr(aRootFields, "FieldName"); //remove duplicate record prevent dup items on UI
			this.bcheckTable = false;
			//check deep items
			if (bDeep === true) {
				aSourceFields = aOriginalSourceFields;
			}
			if (aSourceFields.length > 0) {
				// create dynamic SimpleForm
				var oMoreOptionFormInternational = new SimpleForm({
					width: "auto",
					editable: true,
					layout: "ResponsiveGridLayout",
					labelSpanXL: 6,
					labelSpanL: 6,
					labelSpanM: 6,
					labelSpanS: 4,
					columnsXL: 4,
					columnsL: 4,
					columnsM: 3
				}).addStyleClass("border_lightgray sapUiSmallMarginBottom");

				var sFieldGroup = "";
				for (var i = 0; i < aSourceFields.length; i++) {
					if (aSourceFields[i].FieldGroup !== sFieldGroup && aSourceFields[i].Sequence === "01") {
						if (aSourceFields[i].FieldType !== "10") {
							var oTitle = new sap.ui.core.Title({
								text: aSourceFields[i].GroupText
							});
							oMoreOptionFormInternational.addContent(oTitle);
						}
						sFieldGroup = aSourceFields[i].FieldGroup;
					}
					// if (aSourceFields[i].carrcode === "" || aSourceFields[i].field_name === "") {
					// 	continue;
					// }
					var oLabel = ControlUtils.Label(aSourceFields[i].FieldDesc);
					if (aSourceFields[i].FieldType !== "08") {
						oMoreOptionFormInternational.addContent(oLabel);
					}
					//Build dynamic fields
					var thisInstance = this;
					var oSourceField = Object.assign({}, aSourceFields[i]);
					oSourceField.ComboboxValues = (aSourceFields[i].value_list) ? aSourceFields[i].value_list.results : []; //set data for combobox
					//Add event for checkbox if fieldValue not null
					if (aSourceFields[i].FieldType === "02" && aSourceFields[i].FieldValue1 !== "") {
						//add checkbox event to enable disable button
					}
					//Field type button event handler
					if (aSourceFields[i].FieldType === "08") {
						oSourceField.FnCallback = function (data) {
							var aDeepFields;
							var oMoreOptionChild;
							if (oDataOld.length === aOriginalSourceFields.length) {
								aDeepFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderInternationOptionsFormContent(aDeepFields, oController, true, bShipment, oDataOld);
									thisInstance.renderDialogInternationalOptions(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							} else {
								aDeepFields = Utils._getExistItemsArray(oDataOld, "FieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderInternationOptionsFormContent(aDeepFields, oController, true, bShipment, oDataOld);
									thisInstance.renderDialogInternationalOptions2(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							}

						};
					}

					var oFieldBase = ControlUtils.BuildControlByType(oSourceField, oController);
					// Disable option before add to content
					if (aSourceFields[i].DisplayOption === "1" || aSourceFields[i].DisplayOption === "2") {
						if (aSourceFields[i].DisplayOption === "2") {
							oLabel.setRequired(true);
						} else {
							oLabel.setRequired(false);
						}
						if (aSourceFields[i].FieldType === "10") {
							oFieldBase.setVisible(false);
						} else {
							oFieldBase.setEnabled(true);
						}
					} else {
						//Axo 6913
						oFieldBase.setEnabled(false);
					}
					//Axo 4770
					if (oController.isCanShip === false) {
						oFieldBase.setEnabled(false);
					}
					if (aSourceFields[i].FieldType === "08") {
						oFieldBase.addStyleClass("sapUiTinyMarginTop");
					} else {
						oFieldBase.setWidth("auto");
					}
					oMoreOptionFormInternational.addContent(oFieldBase);
					if (aSourceFields[i].FieldValue2 !== "") {
						if (aSourceFields[i].FieldValue2.column.length > 0) {
							this.bcheckTable = true;
							var aData = aSourceFields[i].FieldValue2;
							var aDataSearchHelp = aSourceFields[i].Searchhelp;
							var columns = aData.column.map(function (column) {
								var key = Object.keys(column)[0];
								var disabled = column.disable || false;
								return {
									label: column[key],
									property: key,
									disabled: disabled
								};
							});
							oController.oTableInternation = new sap.m.Table({
								columns: columns.map(function (column) {
									return new sap.m.Column({
										header: new sap.m.Text({
											text: column.label
										})
									});
								})
							});
							aData.value.forEach(function (obj, index) {
								var oRow = new sap.m.ColumnListItem();
								columns.forEach(function (column) {
									var value = obj[column.property];
									var cell;
									if (typeof value === "string") {
										cell = new sap.m.Input({
											value: value,
											name: column.property,
											editable: !column.disabled,
											valueHelpOnly: true,
											showValueHelp: true,
											valueHelpRequest: function (oEvent) {
												oController._FieldSource = oEvent.getSource();
												this.oF4Dlg = thisInstance.buildF4Dialog(oEvent, oController, aDataSearchHelp)
												this.oF4Dlg.open();
											},
										});
									} else if (typeof value === 'undefined') {
										cell = new sap.m.Text({
											text: ''
										});
									}
									oRow.addCell(cell);
								});

								oController.oTableInternation.addItem(oRow);
							});
							// Add a search field to the table
							var oSearchField = new sap.m.SearchField({
								placeholder: "Search...",
								width: "30rem",
								liveChange: function (oEvent) {
									var sValue = oEvent.getParameter("newValue").toLowerCase();
									var aItems = oController.oTableInternation.getItems();
									for (var i = 0; i < aItems.length; i++) {
										var aCells = aItems[i].getCells();
										var bMatchFound = false;
										for (var j = 0; j < aCells.length; j++) {
											var sCellText = "";
											if (aCells[j] instanceof sap.m.Input) {
												sCellText = aCells[j].getValue().toLowerCase();
											} else if (aCells[j] instanceof sap.m.Text) {
												sCellText = aCells[j].getText().toLowerCase();
											}
											if (sCellText.indexOf(sValue) !== -1) {
												bMatchFound = true;
												break;
											}
										}
										aItems[i].setVisible(bMatchFound);
									}
								}
							}).addStyleClass("sapUiTinyMarginEnd");
							var oToolbarSpacer = new sap.m.ToolbarSpacer();
							//title to the table
							var oTitle = new sap.m.Title({
								text: aSourceFields[i].FieldDesc,
								level: sap.ui.core.TitleLevel.H2
							});
							//toolbar to the table
							var oToolbar = new sap.m.Toolbar({
								content: [oTitle, oToolbarSpacer, oSearchField]
							});
							var oVBoxTable = new sap.m.VBox({
								items: [oToolbar, oController.oTableInternation]
							});
						}
					}
				} //end loop
				if (this.bcheckTable) {
					var oContainer = new sap.m.FlexBox({
						direction: "Column",
						items: [
							oMoreOptionFormInternational,
							oVBoxTable
						]
					});
					return oContainer;
				} else {
					return oMoreOptionFormInternational;
				} // return the VBox instead of the SimpleForm
			}
			return null;
		},

		// handle Dialog International
		renderDialogInternationalOptions: function (oContent, deepId, sTitle, oController, oDynamicInstance) {
			//remove old dialog to avoid duplicate
			if (oController._deepFormDialogInternational) {
				oController._deepFormDialogInternational.destroy();
				oController._deepFormDialogInternational = null;
			}
			//create new dialog
			oController._deepFormDialogInternational = new sap.m.Dialog({
				id: deepId,
				title: sTitle,
				content: oContent,
				state: "Success",
				stretch: true,
				endButton: new sap.m.Button({
					text: "Close",
					press: function () {
						if (oController._deepFormDialogInternational.getContent()[0]) {
							oDynamicInstance.getDynamicInternationalDataForDialog(oController._deepFormDialogInternational, oController,
								oDynamicInstance, false);
							oController._deepFormDialogInternational.close();
							oController._deepFormDialogInternational.destroy();
						}
					}
				})
			});
			oController.getView().addDependent(oController._deepFormDialogInternational);
			oController._deepFormDialogInternational.open();

		},
		renderDialogInternationalOptions2: function (oContent, deepId, sTitle, oController, oDynamicInstance) {
			//create new dialog
			oController._deepFormDialogInternational2 = new sap.m.Dialog({
				id: deepId,
				title: sTitle,
				content: oContent,
				state: "Success",
				stretch: true,
				endButton: new sap.m.Button({
					text: "Close",
					press: function () {
						if (oController._deepFormDialogInternational2.getContent()[0]) {
							oDynamicInstance.getDynamicInternationalDataForDialog(oController._deepFormDialogInternational2, oController,
								oDynamicInstance, false);
						}
						oController._deepFormDialogInternational2.close();
						oController._deepFormDialogInternational2.destroy();
					}
				})
			});
			oController.getView().addDependent(oController._deepFormDialogInternational2);
			oController._deepFormDialogInternational2.open();
		},

		//get dynamic data for package level
		getDynamicInternationalDataForDialog: function (oDialogInstance, oController, oDynamicInstance, isDeep) {

			if (oDialogInstance === null) {
				return;
			}
			var aControls;
			if (oDialogInstance.getContent()[0]) {
				if (oDialogInstance.getContent()[0] instanceof sap.m.FlexBox) {
					aControls = oDialogInstance.getContent()[0].getItems()[0].getContent();
				} else {
					aControls = oDialogInstance.getContent()[0].getContent();
				}
				if (aControls.length > 0) {
					if (!oDynamicInstance.isShipment) {
						//for package level
						if (!oController.currentFUPath) {
							return;
						}
						var oFreightUnitItemRow = oController.getModel("local").getProperty(oController.currentFUPath);
						for (var i = 0; i < aControls.length; i++) {
							if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataFromDynamicInternationControl(aControls[i], oFreightUnitItemRow, "PACKAGE");
							}
						}

						oController.getModel("local").setProperty(oController.currentFUPath, oFreightUnitItemRow);
					} else {
						//for shipment level
						var oShipmentInternationOptions = oController.getModel("local").getProperty("/Internationaloptions");
						for (var s = 0; s < aControls.length; s++) {
							if (!(aControls[s] instanceof sap.m.Button || aControls[s] instanceof sap.m.Label || aControls[s] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataFromDynamicInternationControl(aControls[s], oShipmentInternationOptions, "SHIPMENT");
							}
						}
						oController.getModel("local").setProperty("/Internationaloptions", oShipmentInternationOptions);
					}
				}
			}
		},

		_getDataFromDynamicInternationControl: function (oControl, oSource, sLevel) {
			var sFieldName = oControl.getId(),
				sValue1 = "",
				sValue2 = "";
			//remove prefix
			sFieldName = sFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENTX_", "");

			if (oControl instanceof sap.m.CheckBox) {
				sValue1 = oControl.getSelected() ? "X" : "";
			} else if (oControl instanceof sap.m.ComboBox) {
				sValue1 = oControl.getSelectedKey();
			} else if (oControl instanceof sap.m.Input) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.DateRangeSelection) {
				var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyyMMdd"
				});
				sValue1 = dateFormat.format(oControl.getDateValue());
				sValue2 = dateFormat.format(oControl.getSecondDateValue());
			} else if (oControl instanceof sap.m.DatePicker) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.RadioButton) {
				sValue1 = oControl.getSelected();
			} else if (oControl instanceof sap.m.TimePicker) {
				sValue1 = oControl.getValue();
			}
			this._updateInternationOptionData(oSource, sFieldName, sValue1, sValue2, sLevel);
		},

		_updateInternationOptionData: function (oSource, sFieldName, sValue1, sValue2, sLevel) {
			if (!sFieldName) {
				return;
			}
			//process for package
			if (sLevel === "PACKAGE") {
				for (var i = 0; i < oSource.carrier_more_option.results.length; i++) {
					var packageFieldName = oSource.carrier_more_option.results[i].FieldName;
					packageFieldName = packageFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENTX_", "");
					if (packageFieldName === sFieldName) {
						oSource.carrier_more_option.results[i].FieldValue1 = sValue1;
						// oSource.carrier_more_option.results[i].field_value = sValue2;
						break;
					}
				}

			}

			//process for shipment
			if (sLevel === "SHIPMENT") {
				for (var s = 0; s < oSource.length; s++) {
					var shipmentFieldName = oSource[s].FieldName;
					shipmentFieldName = shipmentFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENTX_", "");
					if (shipmentFieldName === sFieldName) {
						oSource[s].FieldValue1 = sValue1;
						// oSource[s].field_value = sValue2;
						break;
					}
				}
			}
		},

		//get dynamic data for shipment level international option
		getDynamicDataForShipmentInternationOptionForm: function (oForm, oController, oDynamicInstance) {
			if (oForm.getContent().length > 0) {
				if (oForm.getContent()[0]) {
					var aControls = oForm.getContent();
					if (aControls.length > 0) {
						var oShipmentInternationOptions = oController.getModel("local").getProperty("/Internationaloptions");
						for (var i = 0; i < aControls.length; i++) {
							if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDataFromDynamicInternationControl(aControls[i], oShipmentInternationOptions, "SHIPMENT");
							}
						}
						oController.getModel("local").setProperty("/Internationaloptions", oShipmentInternationOptions);
					}
				}
			}
		},
		removePrefixInternationalShipment: function (oController) {
			var aShipmentInternatiolOptions = oController.getModel("local").getProperty("/Internationaloptions");
			aShipmentInternatiolOptions = this.removePrefixBeforeExecuteInternational(aShipmentInternatiolOptions);
			oController.getModel("local").setProperty("/Internationaloptions", aShipmentInternatiolOptions);

		},
		removePrefixBeforeExecuteInternational: function (aSources) {
			aSources.forEach(function (item) {
				item.FieldName = item.FieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENTX_", "");
			});
			return aSources;
		},
		buildF4Dialog: function (oEvent, oController, aDataSearchHelp) {
			var sValue = oEvent.getSource().getName();
			var oObject = aDataSearchHelp.find(function (obj) {
				return Object.keys(obj).some(function (key) {
					return key === sValue;
				});
			});
			var aResult = oObject && oObject.result;
			var oDlgItem = new sap.m.StandardListItem({
				title: "{ValueF4>Value}",
				description: "{ValueF4>Description}"

			});
			var oModelF4 = new sap.ui.model.json.JSONModel({
				aList: aResult
			});
			var oDlg = new sap.m.SelectDialog({
				title: "Search Help",
				search: [this.handleF4ValueHelpSearch, this],
				confirm: [this.fnHandleConfirm, oController],
				items: {
					path: "ValueF4>/aList",
					template: oDlgItem
				}
			});
			oDlg.setModel(oModelF4, "ValueF4");
			oController.getView().addDependent(oDlg);
			return oDlg;
		},

		handleF4ValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new sap.ui.model.Filter("Value", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		fnHandleConfirm: function (event) {
			var oSelectedItem = event.getParameter("selectedItem");
			var aInternationaloptions = this.getModel("local").getProperty("/Internationaloptions");
			if (oSelectedItem) {
				this._FieldSource.setValue(oSelectedItem.getTitle());
			}
			event.getSource().getBinding("items").filter([]);
			var aItems = this.oTableInternation.getItems();
			var aData = [];
			aItems.forEach(function (oItem) {
				var oCells = oItem.getCells();
				var oRowData = {};
				oCells.forEach(function (oCell) {
					if (oCell instanceof sap.m.Input) {
						var sValue = oCell.getValue();
						var sPropertyName = oCell.getName();
						oRowData[sPropertyName] = sValue;
					} else if (oCell instanceof sap.m.Text) {
						return;
					}

				});
				aData.push(oRowData);
			});
			aInternationaloptions.forEach(function (item) {
				if (item.FieldValue2 !== "") {
					item.FieldValue2 = Object.assign({}, item.FieldValue2, {
						value: aData
					});
				}
			})

		},

		//end

	};
});