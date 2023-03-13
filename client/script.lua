--# selene: allow(parenthese_conditions)

------- 
-- Made by: corehimself
-- Created: 2/28/2023
-- Updated: 3/12/2023
-------

-- // Services
local Players = game:GetService("Players");
local DataStoreService = game:GetService("DataStoreService");

-- // Variables
local mainStore = DataStoreService:GetDataStore("DTRD");
local cooldownSeconds = (math.random(6, 14));

-- // Functions
-------------------------- 

-- Temp. Anti-Api-Exhaust

--------------------------
local function banHandler(player, banEndTime)
    if banEndTime == "permanent" then 
        player:Kick("You are permanently banned.") 
        return false
    end

    local banEndDateTime = os.date("!%Y-%m-%dT%H:%M:%S", tonumber(banEndTime))
    local currentDateTime = os.date("!%Y-%m-%dT%H:%M:%S")

    if currentDateTime < banEndDateTime then
        player:Kick("You are banned until "..banEndTime..".")
        return
    else
        -- Remove the ban from the database
        local success, error = pcall(function()
            mainStore:UpdateAsync("user_"..player.UserId, function(old)
                return "stressFree"
            end)
        end)

        if (success) then
            check(player)
            return
        else
            warn("Error removing ban for "..player.Name..": "..tostring(error))
        end
    end
end

local function check(player)
    spawn(function()
        while wait(cooldownSeconds) do
            local success, info = pcall(function()
                return mainStore:GetAsync("user_".. player.UserId)
            end)
            
            if success and info then
                if info.method == "Ban" and info.time then
                    banHandler(player, info.time)
                elseif info.method == "Kick" then
                    player:Kick("DTR")
                end
            end
        end
    end)
end

-- // Init
Players.PlayerAdded:Connect(function(player)
    local success, info = pcall(function()
        return mainStore:GetAsync("user_".. player.UserId)
    end)

    if not success then
        wait(3)
        check(player)
    elseif info then
        if info.method and info.method == "Ban" and info.banEndTime then
            banHandler(player, info.banEndTime)
        elseif info == "Kick" or info == "Unban" then
            local success2, error2 = pcall(function()
                mainStore:UpdateAsync("user_"..player.UserId, function(old)
                    return "stressFree"
                end)
            end)

            if (success2) then
                check(player)
                return
            else
                warn("Error unban/kick for "..player.Name..": "..tostring(error2))
            end
        else
            check(player)
        end
    else
        wait(3)
        check(player)
    end
end)