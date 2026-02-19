// ============================================
// COSTS - Starting Money
// ============================================
export const COST_STARTING_MONEY = 10160

// ============================================
// COSTS - Initial Purchase
// ============================================
export const COST_INITIAL_SHOP = 10000

// ============================================
// COSTS - Core Stations
// ============================================
export const COST_BURGER_STATION = 50
export const COST_BURGER_STATION_2 = 180
export const COST_GRILL_STATION = 100
export const COST_CHECKOUT_STATION = 100

// ============================================
// COSTS - Tables
// ============================================
export const COST_TABLE_1 = 5
export const COST_TABLE_2 = 35
export const COST_TABLE_3 = 100
export const COST_TABLE_4 = 220
export const COST_TABLE_5 = 440
export const COST_TABLE_6 = 550
export const COST_TABLE_7 = 980
export const COST_TABLE_8 = 1150
export const COST_TABLE_9 = 3000
export const COST_TABLE_10 = 3450
export const COST_TABLE_11 = 3950
export const COST_TABLE_12 = 4550
export const COST_TABLE_13 = 5250
export const COST_TABLE_14 = 6050
export const COST_TABLE_15 = 8000

// ============================================
// COSTS - Advanced Features
// ============================================
export const COST_CASHIER = 25
export const COST_HR_STATION = 45
export const COST_UPGRADE_STATION = 60
export const COST_DRIVE_THRU = 60
export const COST_DRIVE_THRU_CASHIER = 140
export const COST_EXPANSION_STATION = 280
export const COST_EXPANSION_STATION_2 = 850
export const COST_EXPANSION_STATION_3 = 1300
export const COST_PATIO_STATION = 350
export const COST_SELF_CHECKOUT_STATION = 350
export const COST_BATHROOM_STATION = 400
export const COST_BATHROOM_STATION_2 = 800

// ============================================
// COSTS - Item Prices
// ============================================
export const COST_BURGER_PRICE = 4
export const COST_DRIVE_THRU_BURGER_PRICE = 4
export const COST_TABLE_TIP_MIN = 3
export const COST_TABLE_TIP_MAX = 5
export const COST_SHAKE_PRICE = 4

// ============================================
// COSTS - Employee Hire Costs
// ============================================
export const COST_EMPLOYEE_HIRE = [0, 120, 360, 1080, 3240]

// ============================================
// COSTS - Employee Speed Upgrade Costs
// ============================================
export const COST_EMPLOYEE_SPEED_UPGRADES = [80, 240, 720, 2160, 6480]

// ============================================
// COSTS - Employee Inventory Upgrade Costs
// ============================================
export const COST_EMPLOYEE_INVENTORY_UPGRADES = [80, 240, 720, 2160, 6480]

// ============================================
// COSTS - Player Speed Upgrade Costs
// ============================================
export const COST_PLAYER_SPEED_UPGRADES = [60, 180, 540, 1620, 4860]

// ============================================
// COSTS - Player Inventory Upgrade Costs
// ============================================
export const COST_PLAYER_INVENTORY_UPGRADES = [0, 240, 720, 2160, 6480]

// ============================================
// COSTS - Player Profit Upgrade Costs
// ============================================
export const COST_PLAYER_PROFIT_UPGRADES = [300, 900, 2700, 8100, 24300]

// ============================================
// COSTS - Grill Upgrade Costs
// ============================================
export const COST_GRILL_UPGRADES = [100, 800, 2400]

// ============================================
// COSTS - Shake Station Costs
// ============================================
export const COST_SHAKE_STATION = 1500
export const COST_SHAKE_STATION_2 = 2600
export const COST_SHAKE_CHECKOUT = 50
export const COST_SHAKE_CASHIER = 2250
export const COST_SHAKE_UPGRADES = [1950, 3000, 5000]

// ============================================
// COSTS - Cashier Speed Upgrade Costs
// ============================================
export const COST_CASHIER_SPEED_UPGRADES = [150, 450]
export const COST_DRIVETHRU_CASHIER_SPEED_UPGRADES = [200, 800]
export const COST_SHAKE_CASHIER_SPEED_UPGRADES = [2500, 3500]

// ============================================
// CASHIER SPEED (checkout time in seconds per item)
// ============================================
export const CASHIER_CHECKOUT_SPEEDS = [3.0, 2.0, 1.0]  // Base, Level 1, Level 2
export const PLAYER_CHECKOUT_SPEED = 0.3  // Player is always fast

// ============================================
// PLAYER UPGRADES
// ============================================
export const PLAYER_ACCELERATION = 60
export const PLAYER_TURN_SPEED = 15
export const PLAYER_INVENTORY_SIZES = [2, 4, 5, 6, 8, 10]
export const PLAYER_SPEEDS = [3.8, 4.2, 4.6, 5, 5.4, 5.8]
export const PLAYER_PROFIT_MULTIPLIERS = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0]

// ============================================
// EMPLOYEE UPGRADES
// ============================================
export const EMPLOYEE_MAX_COUNT = 5
export const EMPLOYEE_SPEEDS = [1.6, 2.2, 2.8, 3.4, 4, 4.6]
export const EMPLOYEE_INVENTORY_SIZES = [2, 3, 4, 5, 6, 7]

// ============================================
// GRILL/BURGER STATION
// ============================================
export const GRILL_PRODUCTION_DURATIONS = [5, 3, 2, 1]
export const GRILL_MAX_INVENTORY = [4, 7, 10, 14]

// ============================================
// SHAKE STATION
// ============================================
export const SHAKE_PRODUCTION_DURATIONS = [4.5, 3, 2.5, 1.5]
export const SHAKE_MAX_INVENTORY = [4, 6, 10, 14]

// ============================================
// CUSTOMER SPAWNING
// ============================================
export const CUSTOMER_SPAWN_INTERVAL_MIN = 0.6
export const CUSTOMER_SPAWN_INTERVAL_MAX = 1.0
export const CUSTOMER_MAX_IN_LINE_COUNT = 5
export const CUSTOMER_INITIAL_COUNT = 5

// ============================================
// EATING TIME
// ============================================
export const EATING_TIME_MIN = 4.0
export const EATING_TIME_MAX = 10.0
export const ORDER_TIME = 5.0

// ============================================
// BATHROOM
// ============================================
export const USING_BATHROOM_TIME_MIN = 9.0
export const USING_BATHROOM_TIME_MAX = 18.0
export const BATHROOM_USE_CHANCE = 0.67
export const COST_BATHROOM_TIP_MIN = 5
export const COST_BATHROOM_TIP_MAX = 7
export const BATHROOM_HEALTH_MIN = 2
export const BATHROOM_HEALTH_MAX = 5

// ============================================
// DRIVE-THRU
// ============================================
export const DRIVETHRU_MAX_CARS = 7
export const DRIVETHRU_CAR_SPEED = 8.0
export const DRIVETHRU_CAR_SPACING = 9.0
export const DRIVETHRU_SPAWN_INTERVAL_MIN = 1.0
export const DRIVETHRU_SPAWN_INTERVAL_MAX = 2.0
export const DRIVETHRU_INITIAL_CAR_COUNT = 3
export const DRIVETHRU_INITIAL_SPAWN_INTERVAL_MIN = 1.0
export const DRIVETHRU_INITIAL_SPAWN_INTERVAL_MAX = 2.0
export const DRIVETHRU_WINDOW_POSITION = 0.386
export const DRIVETHRU_INITIAL_SPLINE_POSITION = 0.15

// ============================================
// SELF CHECKOUT
// ============================================
export const SELF_CHECKOUT_SPAWN_INTERVAL_MIN = 0.6
export const SELF_CHECKOUT_SPAWN_INTERVAL_MAX = 1.0
export const SELF_CHECKOUT_MAX_CUSTOMERS_IN_LINE = 5
export const SELF_CHECKOUT_TIME = 0.5
export const SELF_CHECKOUT_DECIDING_TIME_MIN = 8.0  // Min time customer spends deciding
export const SELF_CHECKOUT_DECIDING_TIME_MAX = 15.0  // Max time customer spends deciding

// ============================================
// TABLE
// ============================================
export const TABLE_TRASH_MIN = 1
export const TABLE_TRASH_MAX = 2

// ============================================
// ORDER COUNTS (burgers/shakes per customer)
// ============================================
export const BURGER_ORDER_MIN = 1
export const BURGER_ORDER_MAX = 2
export const SHAKE_ORDER_MIN = 1
export const SHAKE_ORDER_MAX = 2

// ============================================
// PICKUPS
// ============================================
export const PICKUP_SPAWN_TIME = 40
export const PICKUP_LIFE_SPAN = 20
export const PICKUP_INVENTORY_DURATION = 60
export const PICKUP_SPEED_DURATION = 60

// ============================================
// LEVELING SYSTEM
// ============================================
export const XP_PER_DOLLAR = 1  // Multiplier for cost to XP conversion
export const LEVEL_XP_THRESHOLDS = [
  0,       // Level 1 (starting level)
  200,     // Level 2
  1000,    // Level 3
  2500,    // Level 4
  5000,    // Level 5
  10000,   // Level 6
]

// Level-based order counts (index = level - 1)
// Drive-thru order range per car
export const LEVEL_DRIVETHRU_ORDER_MIN = [2, 2, 3, 4, 4, 4]
export const LEVEL_DRIVETHRU_ORDER_MAX = [3, 3, 4, 5, 6, 8]

// Checkout order range per customer (burgers)
export const LEVEL_CHECKOUT_ORDER_MIN = [1, 1, 1, 2, 2, 3]
export const LEVEL_CHECKOUT_ORDER_MAX = [1, 2, 3, 3, 4, 4]

// Checkout order range per customer (shakes)
export const LEVEL_SHAKE_CHECKOUT_ORDER_MIN = [1, 1, 1, 2, 2, 3]
export const LEVEL_SHAKE_CHECKOUT_ORDER_MAX = [1, 2, 3, 3, 4, 4]

// Self-checkout order range per customer
export const LEVEL_SELF_CHECKOUT_ORDER_MIN = [1, 1, 1, 2, 2, 3]
export const LEVEL_SELF_CHECKOUT_ORDER_MAX = [1, 2, 3, 3, 4, 4]

// VIP order range per customer
export const LEVEL_VIP_ORDER_MIN = [3, 4, 5, 6, 7, 8]
export const LEVEL_VIP_ORDER_MAX = [5, 6, 8, 9, 11, 14]
export const VIP_LIFESPAN_PER_ORDER_COUNT = 12.0 // seconds per order count, an order of 4 burgers is 28 seconds
export const VIP_CUSTOMER_SPAWN_INTERVAL_MIN = 60
export const VIP_CUSTOMER_SPAWN_INTERVAL_MAX = 180
export const VIP_REWARD_VALUE_MULTIPLIER = 4.0

// Maximum customers/cars in line per level
export const LEVEL_CUSTOMER_MAX_IN_LINE = [5, 6, 7, 8, 9, 10]
export const LEVEL_CAR_MAX_IN_LINE = [3, 3, 5, 6, 8, 9]

// Seconds before purchase interaction starts when standing in purchase area
export const PURCHASE_AREA_DELAY = 0.8

// Seconds to fully drain a purchase area (how fast money flows in)
export const PURCHASE_AREA_FILL_DURATION = 2