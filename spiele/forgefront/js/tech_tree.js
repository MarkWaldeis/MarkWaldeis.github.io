/**
 * BUILDERMENT 3D - TECHNOLOGY & RESEARCH TREE
 */

const TECH_TREE_DATA = [
    // Stufe 1: Grundlagen
    {
        id: "basic_logistics",
        title: "Grundlagen der Logistik",
        desc: "Schaltet Förderbänder, Bohrer und das Abrisswerkzeug für die erste Fabrik frei.",
        costGold: 0,
        prerequisites: [],
        unlocks: ["belt", "extractor", "demolish"],
        tier: 1,
        icon: "🚚",
        unlocked: true
    },
    {
        id: "wood_processing",
        title: "Holzverarbeitung",
        desc: "Schaltet die Werkstatt und die Verarbeitung von Baumstämmen zu Holzplanken frei.",
        costGold: 50,
        prerequisites: [],
        unlocks: ["workshop", "wood_plank"],
        tier: 1,
        icon: "🪵",
        unlocked: true
    },
    {
        id: "iron_smelting",
        title: "Metallurgie",
        desc: "Schaltet den Schmelzofen sowie Eisen- und Kupferbarren frei.",
        costGold: 100,
        prerequisites: [],
        unlocks: ["furnace", "iron_ingot", "copper_ingot"],
        tier: 1,
        icon: "🔥",
        unlocked: true
    },
    {
        id: "stone_processing",
        title: "Gesteinsaufbereitung",
        desc: "Ermöglicht das Mahlen von Stein zu feinem Sand.",
        costGold: 120,
        prerequisites: ["basic_logistics", "wood_processing"],
        unlocks: ["sand"],
        tier: 1,
        icon: "🪨",
        unlocked: false
    },
    {
        id: "underground_logistics",
        title: "Unterirdische Logistik",
        desc: "Schaltet unterirdische Förderstrecken für kreuzungsfreie Warenflüsse frei.",
        costGold: 180,
        prerequisites: ["basic_logistics", "iron_smelting"],
        unlocks: ["underground"],
        tier: 1,
        icon: "🚇",
        unlocked: false
    },

    // Stufe 2: Mechanisierung
    {
        id: "mechanics_gears",
        title: "Präzisionsmechanik",
        desc: "Schaltet Eisen-Zahnräder und gezogenen Kupferdraht in Werkstätten frei.",
        costGold: 400,
        prerequisites: ["wood_processing", "iron_smelting"],
        unlocks: ["iron_gear", "copper_wire", "iron_plating", "heat_sink"],
        tier: 2,
        icon: "⚙️",
        unlocked: false
    },
    {
        id: "glassworks",
        title: "Glashütte",
        desc: "Ermöglicht das Schmelzen von aufbereitetem Sand zu Glas.",
        costGold: 350,
        prerequisites: ["stone_processing", "iron_smelting"],
        unlocks: ["glass", "silicon", "condenser_lens"],
        tier: 2,
        icon: "🔷",
        unlocked: false
    },
    {
        id: "fast_belts_1",
        title: "Schnelle Förderbänder I",
        desc: "Erhöht die Geschwindigkeit aller Förderbänder auf 150 Prozent.",
        costGold: 250,
        prerequisites: ["underground_logistics"],
        unlocks: [],
        tier: 2,
        icon: "⏩",
        unlocked: false,
        effectKey: "conveyor_tier_1_5"
    },
    {
        id: "improved_extraction",
        title: "Verbesserte Förderung",
        desc: "Optimierte Bohrköpfe steigern die Förderleistung aller Extraktoren um 25 Prozent.",
        costGold: 500,
        prerequisites: ["basic_logistics", "mechanics_gears"],
        unlocks: [],
        tier: 2,
        icon: "⛏️",
        unlocked: false,
        effectKey: "extractor_tier_1_25"
    },
    {
        id: "structural_engineering",
        title: "Konstruktionslehre",
        desc: "Schaltet stabile Holzrahmen für komplexe Industrieanlagen frei.",
        costGold: 550,
        prerequisites: ["wood_processing", "mechanics_gears"],
        unlocks: ["wood_frame", "metal_frame"],
        tier: 2,
        icon: "🪚",
        unlocked: false
    },

    // Stufe 3: Schwerindustrie
    {
        id: "steel_foundry",
        title: "Stahlgießerei",
        desc: "Schaltet die Schmiede und die Herstellung belastbarer Stahlbarren frei.",
        costGold: 800,
        prerequisites: ["mechanics_gears", "stone_processing"],
        unlocks: ["forge", "graphite", "steel", "tungsten_ore", "tungsten_carbide", "steel_rod", "carbon_fiber", "concrete", "coupler"],
        tier: 3,
        icon: "🔩",
        unlocked: false
    },
    {
        id: "electromagnetism",
        title: "Elektromagnetismus",
        desc: "Schaltet die Maschinenhalle und die Fertigung von Elektromagneten frei.",
        costGold: 1500,
        prerequisites: ["mechanics_gears", "glassworks"],
        unlocks: ["machine_shop", "electromagnet", "logic_circuit", "nano_wire", "rotor"],
        tier: 3,
        icon: "🧲",
        unlocked: false
    },
    {
        id: "electric_drives",
        title: "Elektrische Antriebe",
        desc: "Kombiniert Mechanik und Elektrizität zur Fertigung leistungsfähiger Elektromotoren.",
        costGold: 1800,
        prerequisites: ["steel_foundry", "electromagnetism"],
        unlocks: ["electric_motor", "battery", "gyroscope", "energy_cube"],
        tier: 3,
        icon: "⚡",
        unlocked: false
    },
    {
        id: "microelectronics",
        title: "Mikroelektronik",
        desc: "Ermöglicht die präzise Fertigung elektronischer Mikrochips.",
        costGold: 2200,
        prerequisites: ["electromagnetism", "glassworks"],
        unlocks: ["particle_glue"],
        tier: 3,
        icon: "🔬",
        unlocked: false
    },
    {
        id: "industrial_planning",
        title: "Industrieplanung",
        desc: "Schaltet die Industriefabrik für mehrstufige Produktionsketten frei.",
        costGold: 2600,
        prerequisites: ["electric_drives", "microelectronics", "structural_engineering"],
        unlocks: ["industrial_factory", "industrial_frame", "tank", "stabilizer"],
        tier: 3,
        icon: "🏗️",
        unlocked: false
    },

    // Stufe 4: Automatisierung
    {
        id: "fast_belts_2",
        title: "Schnelle Förderbänder II",
        desc: "Verdoppelt die Geschwindigkeit aller Förderbänder.",
        costGold: 3000,
        prerequisites: ["fast_belts_1", "electric_drives"],
        unlocks: [],
        tier: 4,
        icon: "💨",
        unlocked: false,
        effectKey: "conveyor_tier_2"
    },
    {
        id: "deep_mining",
        title: "Tiefenförderung",
        desc: "Verstärkte Antriebe erhöhen die Förderleistung aller Extraktoren um 75 Prozent.",
        costGold: 3400,
        prerequisites: ["improved_extraction", "steel_foundry", "electric_drives"],
        unlocks: [],
        tier: 4,
        icon: "🛠️",
        unlocked: false,
        effectKey: "extractor_tier_1_75"
    },
    {
        id: "computer_technology",
        title: "Computertechnik",
        desc: "Schaltet die Montage von Computern aus Mikrochips und Elektromotoren frei.",
        costGold: 5000,
        prerequisites: ["industrial_planning", "microelectronics", "electric_drives"],
        unlocks: ["computer"],
        tier: 4,
        icon: "💻",
        unlocked: false
    },
    {
        id: "process_control",
        title: "Prozesssteuerung",
        desc: "Vernetzt Sensorik und Maschinensteuerung für automatisierte Fabrikabläufe.",
        costGold: 5600,
        prerequisites: ["industrial_planning", "computer_technology"],
        unlocks: ["process_controller", "turbocharger"],
        tier: 4,
        icon: "🎛️",
        unlocked: false
    },
    {
        id: "heavy_manufacturing",
        title: "Schwerfertigung",
        desc: "Schaltet den Hersteller für die anspruchsvollsten Endprodukte frei.",
        costGold: 6500,
        prerequisites: ["steel_foundry", "industrial_planning", "process_control"],
        unlocks: ["manufacturer", "matter_compressor", "magnetic_field_generator", "electron_microscope"],
        tier: 4,
        icon: "🏭",
        unlocked: false
    },

    // Stufe 5: Hochtechnologie
    {
        id: "fast_belts_3",
        title: "Schnelle Förderbänder III",
        desc: "Verdreifacht mit Magnetschwebetechnik die Geschwindigkeit aller Förderbänder.",
        costGold: 8000,
        prerequisites: ["fast_belts_2", "process_control"],
        unlocks: [],
        tier: 5,
        icon: "🚀",
        unlocked: false,
        effectKey: "conveyor_tier_3"
    },
    {
        id: "precision_extraction",
        title: "Präzisionsförderung",
        desc: "Computergesteuerte Bohrer fördern Rohstoffe mit zweieinhalbfacher Leistung.",
        costGold: 8500,
        prerequisites: ["deep_mining", "computer_technology"],
        unlocks: [],
        tier: 5,
        icon: "💎",
        unlocked: false,
        effectKey: "extractor_tier_2_5"
    },
    {
        id: "advanced_computing",
        title: "Hochleistungsrechner",
        desc: "Schaltet die Fertigung massiv paralleler Supercomputer frei.",
        costGold: 10000,
        prerequisites: ["computer_technology", "process_control"],
        unlocks: ["super_computer", "atomic_locator"],
        tier: 5,
        icon: "🖥️",
        unlocked: false
    },
    {
        id: "quantum_materials",
        title: "Quantenmaterialien",
        desc: "Erschließt exotische Werkstoffe für Geräte jenseits klassischer Elektronik.",
        costGold: 12000,
        prerequisites: ["advanced_computing", "electromagnetism", "heavy_manufacturing"],
        unlocks: ["quantum_core", "enriched_uranium", "empty_fuel_cell", "nuclear_fuel_cell"],
        tier: 5,
        icon: "⚛️",
        unlocked: false
    },
    {
        id: "planetary_industry",
        title: "Planetare Industrie",
        desc: "Vereinheitlicht Hochtechnologie und Schwerfertigung für Projekte globalen Maßstabs.",
        costGold: 14000,
        prerequisites: ["fast_belts_3", "precision_extraction", "advanced_computing", "heavy_manufacturing"],
        unlocks: ["planetary_project", "gem_tree"],
        tier: 5,
        icon: "🌐",
        unlocked: false
    },

    // Stufe 6: Zukunftstechnologien
    {
        id: "quantum_entanglement",
        title: "Quantenverschränkung",
        desc: "Schaltet die Fertigung eines stabilen Quantenverschränkers frei.",
        costGold: 18000,
        prerequisites: ["quantum_materials", "advanced_computing"],
        unlocks: ["quantum_entangler", "matter_duplicator"],
        tier: 6,
        icon: "🌀",
        unlocked: false
    },
    {
        id: "autonomous_mining",
        title: "Autonome Rohstoffgewinnung",
        desc: "Selbstoptimierende Fördersysteme verdreifachen die Leistung aller Extraktoren.",
        costGold: 20000,
        prerequisites: ["precision_extraction", "quantum_materials"],
        unlocks: [],
        tier: 6,
        icon: "🤖",
        unlocked: false,
        effectKey: "extractor_tier_3"
    },
    {
        id: "global_logistics",
        title: "Globale Logistik",
        desc: "Vollautomatische Warenverteilung erschließt das planetare Logistiknetz.",
        costGold: 22000,
        prerequisites: ["planetary_industry", "fast_belts_3", "quantum_entanglement"],
        unlocks: ["global_logistics_network"],
        tier: 6,
        icon: "🛰️",
        unlocked: false
    },
    {
        id: "earth_token_project",
        title: "Earth-Token-Synthese",
        desc: "Schaltet das ultimative Endprodukt aus Computern und hochfestem Stahl frei.",
        costGold: 30000,
        prerequisites: ["planetary_industry", "quantum_entanglement", "heavy_manufacturing"],
        unlocks: ["earth_teleporter", "earth_token"],
        tier: 6,
        icon: "🌍",
        unlocked: false
    },
    {
        id: "industrial_singularity",
        title: "Industrielle Singularität",
        desc: "Vollendet den Forschungsbaum durch die Vereinigung autonomer Förderung, globaler Logistik und Earth-Token-Produktion.",
        costGold: 50000,
        prerequisites: ["autonomous_mining", "global_logistics", "earth_token_project"],
        unlocks: ["industrial_singularity"],
        tier: 6,
        icon: "✨",
        unlocked: false
    }
];

const TOOL_IDS = new Set([
    "belt", "underground", "extractor", "furnace", "workshop", "forge",
    "machine_shop", "industrial_factory", "manufacturer", "earth_teleporter", "gem_tree", "demolish"
]);

const RECIPE_ALIASES = {
    "Wood Plank": "wood_plank",
    "Wood Frame": "wood_frame",
    "Sand": "sand",
    "Glass": "glass",
    "Iron Ingot": "iron_ingot",
    "Iron Gear": "iron_gear",
    "Copper Ingot": "copper_ingot",
    "Copper Wire": "copper_wire",
    "Steel": "steel",
    "Electromagnet": "electromagnet",
    "Electric Motor": "electric_motor",
    "Microchip": "microchip",
    "Computer": "computer",
    "Super Computer": "super_computer",
    "Quantum Entangler": "quantum_entangler",
    "Earth Token": "earth_token"
};

class TechTreeManager {
    constructor(simulation) {
        this.simulation = simulation;
        this._techs = this.cloneTechData();
        this.installSimulationHooks();
        this.reapplyEffects();
    }

    get techs() {
        return this._techs;
    }

    set techs(savedTechs) {
        const savedById = new Map(
            Array.isArray(savedTechs)
                ? savedTechs.filter(tech => tech && tech.id).map(tech => [tech.id, tech])
                : []
        );

        this._techs = this.cloneTechData().map(tech => {
            const saved = savedById.get(tech.id);
            if (!saved) return tech;

            return {
                ...tech,
                unlocked: tech.unlocked || saved.unlocked === true
            };
        });

        this.reapplyEffects();
    }

    cloneTechData() {
        return JSON.parse(JSON.stringify(TECH_TREE_DATA));
    }

    isUnlocked(techId) {
        const tech = this._techs.find(candidate => candidate.id === techId);
        return tech ? tech.unlocked === true : false;
    }

    getMissingPrerequisites(techId) {
        const tech = this._techs.find(candidate => candidate.id === techId);
        if (!tech) return [];
        return tech.prerequisites.filter(prerequisiteId => !this.isUnlocked(prerequisiteId));
    }

    canUnlock(techId) {
        const tech = this._techs.find(candidate => candidate.id === techId);
        return Boolean(
            tech &&
            !tech.unlocked &&
            this.getMissingPrerequisites(techId).length === 0 &&
            this.simulation.gold >= tech.costGold
        );
    }

    isToolUnlocked(tool) {
        if (!TOOL_IDS.has(tool)) return false;
        return this._techs.some(tech => tech.unlocked && tech.unlocks.includes(tool));
    }

    isRecipeUnlocked(recipeId) {
        const normalizedId = RECIPE_ALIASES[recipeId] || String(recipeId || '')
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[\s-]+/g, '_')
            .toLowerCase();
        if (!normalizedId || TOOL_IDS.has(normalizedId)) return false;
        return this._techs.some(tech => tech.unlocked && tech.unlocks.includes(normalizedId));
    }

    unlock(techId) {
        const tech = this._techs.find(candidate => candidate.id === techId);
        if (!tech || tech.unlocked) return false;

        const missing = this.getMissingPrerequisites(techId);
        if (missing.length > 0) {
            const titles = missing.map(id => {
                const prerequisite = this._techs.find(candidate => candidate.id === id);
                return prerequisite ? prerequisite.title : id;
            });
            this.showToast(`🔒 Benötigte Forschung: ${titles.join(", ")}`);
            return false;
        }

        if (this.simulation.gold < tech.costGold) {
            this.showToast(`❌ Nicht genug Gold für ${tech.title}!`);
            return false;
        }

        this.simulation.gold -= tech.costGold;
        tech.unlocked = true;
        this.applyEffect(tech.effectKey);

        if (window.soundEngine) window.soundEngine.playUpgrade();
        this.showToast(`🎉 Forschung freigeschaltet: ${tech.title}`);
        if (window.uiManager) window.uiManager.renderTechTree();
        return true;
    }

    applyEffect(effectKey) {
        const conveyorTiers = {
            conveyor_tier_1_5: 1.5,
            conveyor_tier_2: 2,
            conveyor_tier_3: 3
        };
        const extractorTiers = {
            extractor_tier_1_25: 1.25,
            extractor_tier_1_75: 1.75,
            extractor_tier_2_5: 2.5,
            extractor_tier_3: 3
        };

        if (conveyorTiers[effectKey]) {
            this.simulation.conveyorTier = Math.max(
                this.simulation.conveyorTier || 1,
                conveyorTiers[effectKey]
            );
        }

        if (extractorTiers[effectKey]) {
            this.simulation.extractorTier = Math.max(
                this.simulation.extractorTier || 1,
                extractorTiers[effectKey]
            );
            this.simulation.buildings.forEach(building => this.applyExtractorBonus(building));
        }
    }

    reapplyEffects() {
        if (!this.simulation || !this._techs) return;
        this._techs
            .filter(tech => tech.unlocked && tech.effectKey)
            .forEach(tech => this.applyEffect(tech.effectKey));
    }

    applyExtractorBonus(building) {
        if (!building || building.type !== "extractor") return;
        const baseInterval = building.techBaseInterval || building.interval || 3;
        building.techBaseInterval = baseInterval;
        building.interval = baseInterval / (this.simulation.extractorTier || 1);
    }

    installSimulationHooks() {
        if (!this.simulation || this.simulation.techTreeAddBuildingHook) return;

        const originalAddBuilding = this.simulation.addBuilding.bind(this.simulation);
        this.simulation.addBuilding = (...args) => {
            const building = originalAddBuilding(...args);
            this.applyExtractorBonus(building);
            return building;
        };
        this.simulation.techTreeAddBuildingHook = true;
    }

    showToast(message) {
        if (window.uiManager) window.uiManager.showToast(message);
    }
}

window.TechTreeManager = TechTreeManager;
