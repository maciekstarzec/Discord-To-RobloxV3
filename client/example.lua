local DTR = require(script.Parent["DTR v3.2.0"])

function onPlayerAdded(plr)
    DTR.CheckPlayer(plr) -- constantly check
end

game.Players.PlayerAdded:Connect(onPlayerAdded)