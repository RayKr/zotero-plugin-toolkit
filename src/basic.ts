/**
 * Basic APIs with Zotero 6 & newer (7) compatibility.
 * See also https://www.zotero.org/support/dev/zotero_7_for_developers
 */
export class BasicTool {
  /**
   * configurations.
   */
  basicOptions: {
    log: {
      readonly _type: "toolkitlog";
      disableConsole: boolean;
      disableZLog: boolean;
      prefix: string;
    };
  };

  /**
   *
   * @param basicTool Pass an BasicTool instance to copy its options.
   */
  constructor(basicTool?: BasicTool) {
    this.basicOptions = {
      log: {
        _type: "toolkitlog",
        disableConsole: false,
        disableZLog: false,
        prefix: "",
      },
    };
    this.updateOptions(basicTool);
  }

  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero" | "zotero"): _ZoteroConstructable;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "ZoteroPane" | "ZoteroPane_Local"): _ZoteroPaneConstructable;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero_Tabs"): typeof Zotero_Tabs;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero_File_Interface"): typeof Zotero_File_Interface;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero_File_Exporter"): any;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero_LocateMenu"): any;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero_Report_Interface"): any;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero_Timeline_Interface"): any;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "Zotero_Tooltip"): any;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "ZoteroContextPane"): typeof ZoteroContextPane;
  /**
   * @alpha
   * @param k
   */
  getGlobal(k: "ZoteroItemPane"): any;
  /**
   * @alpha
   * @param k
   */
  getGlobal<
    K extends keyof typeof globalThis,
    GLOBAL extends typeof globalThis
  >(k: K): GLOBAL[K];
  /**
   * Get global variables.
   * @param k Global variable name, `Zotero`, `ZoteroPane`, `window`, `document`, etc.
   */
  getGlobal(k: string): any;
  getGlobal(k: string) {
    const _Zotero =
      Zotero ||
      Components.classes["@zotero.org/Zotero;1"].getService(
        Components.interfaces.nsISupports
      ).wrappedJSObject;
    const window = _Zotero.getMainWindow();
    switch (k) {
      case "Zotero":
      case "zotero":
        return _Zotero;
      case "window":
        return window;
      case "document":
        return window.document;
      case "ZoteroPane":
      case "ZoteroPane_Local":
        return _Zotero.getActiveZoteroPane();
      default:
        return window[k];
    }
  }

  /**
   * Check if it's running on Zotero 7 (Firefox 102)
   */
  isZotero7(): boolean {
    return Zotero.platformMajorVersion >= 102;
  }

  /**
   * Get DOMParser.
   *
   * For Zotero 6: mainWindow.DOMParser or nsIDOMParser
   *
   * For Zotero 7: Firefox 102 support DOMParser natively
   */
  getDOMParser(): DOMParser {
    if (this.isZotero7()) {
      return new DOMParser();
    }
    try {
      return new (this.getGlobal("DOMParser"))();
    } catch (e) {
      return Components.classes[
        "@mozilla.org/xmlextras/domparser;1"
      ].createInstance(Components.interfaces.nsIDOMParser);
    }
  }

  /**
   * If it's an XUL element
   * @param elem
   */
  isXULElement(elem: Element): boolean {
    return (
      elem.namespaceURI ===
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
    );
  }

  /**
   * Create an XUL element
   *
   * For Zotero 6, use `createElementNS`;
   *
   * For Zotero 7+, use `createXULElement`.
   * @param doc
   * @param type
   * @example
   * Ceate a `<menuitem>`:
   * ```ts
   * const compat = new ZoteroCompat();
   * const doc = compat.getWindow().document;
   * const elem = compat.createXULElement(doc, "menuitem");
   * ```
   */
  createXULElement(doc: Document, type: string): XUL.Element {
    if (this.isZotero7()) {
      // @ts-ignore
      return doc.createXULElement(type);
    } else {
      return doc.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
        type
      ) as XUL.Element;
    }
  }

  /**
   * Output to both Zotero.debug and console.log
   * @param data e.g. string, number, object, ...
   */
  log(...data: any) {
    if (data.length === 0) {
      return;
    }
    const Zotero = this.getGlobal("Zotero");
    const console = this.getGlobal("console");
    // If logOption is not provides, use the global one.
    let options: typeof this.basicOptions.log;
    if (data[data.length - 1]?._type === "toolkitlog") {
      options = data.pop();
    } else {
      options = this.basicOptions.log;
    }
    try {
      if (options.prefix) {
        data.splice(0, 0, options.prefix);
      }
      if (!options.disableConsole) {
        console.groupCollapsed(...data);
        console.trace();
        console.groupEnd();
      }
      if (!options.disableZLog) {
        Zotero.debug(
          data
            .map((d) => (typeof d === "object" ? JSON.stringify(d) : String(d)))
            .join("\n")
        );
      }
    } catch (e) {
      console.error(e);
      Zotero.logError(e);
    }
  }

  /**
   * Patch a function
   * @param object The owner of the function
   * @param funcSign The signature of the function(function name)
   * @param ownerSign The signature of patch owner to avoid patching again
   * @param patcher The new wrapper of the patched funcion
   */
  patch(
    object: { [sign: string]: any },
    funcSign: string,
    ownerSign: string,
    patcher: (fn: Function) => Function
  ) {
    if (object[funcSign][ownerSign]) {
      throw new Error(`${funcSign} re-patched`);
    }
    this.log("patching", funcSign, `by ${ownerSign}`);
    object[funcSign] = patcher(object[funcSign]);
    object[funcSign][ownerSign] = true;
  }

  protected updateOptions(source?: BasicTool) {
    if (!source) {
      return;
    }
    this.basicOptions = source.basicOptions;
  }
}

export interface ManagerInterface {
  register(...data): any;
  unregister(...data): any;
  /**
   * Unregister everything
   */
  unregisterAll(...data): any;
}
