// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;
contract GuessingGame {


//variables
   address private  owner;
   address private tokenOwner;
    uint256 private amount;        
    bytes32 private hashedSecret;
   bool    public gameActive;

// off_chain
    bool    public lastGuessCorrect;
    uint256 public lastAmountRequested;

    event GameInitialized( uint256 _amount);
    event TokenGiven(address indexed to);
    event GuessResult(address indexed guesser, bool correct, uint256 amountRewarded);
    event GameReset();
   
   modifier onlyOwner(){
    require(msg.sender==owner,"only owner can call the function");
    _;
   }
   modifier onlyTokenOwner() {
        require(msg.sender == tokenOwner, "Not token owner");
        _;
    }

    modifier isActive() {
        require(gameActive, "Game not active");
        _;
    }
    constructor(){
        owner = msg.sender;
    }

    function initGame(
        uint256 _amount,
        string calldata _secret 
    )external payable  onlyOwner{
        require(!gameActive, "game already initialized");
        require(_amount > 0, "amount negative!!!");
        require(msg.value == _amount, "send ETH equal to amount");
        tokenOwner=owner;
        amount=_amount;
        hashedSecret= keccak256(bytes(_secret));
        gameActive=true;  

        emit GameInitialized(_amount);      
    }

    function GiveToken(
        address _tokenOwner
        )external onlyTokenOwner isActive{
        require(_tokenOwner!=address(0),"Invalid address");
        require(_tokenOwner != msg.sender,   "Cannot give to yourself");
        tokenOwner=_tokenOwner;
        emit TokenGiven(_tokenOwner);

    }

    function Guess(
        string calldata _attempt,
        uint256 _Amount,
        address _nextPlayer
    )external payable  onlyTokenOwner isActive{
        require(bytes(_attempt).length > 0, "Attempt cannot be empty");
        require(_Amount > 0,                "Amount must be > 0");
        require(_Amount <= amount, "Exceeds pool");
        lastAmountRequested = _Amount;
        lastGuessCorrect    = (keccak256(abi.encodePacked(_attempt)) == hashedSecret);

        if (lastGuessCorrect) {
              amount      -= _Amount;
             hashedSecret = bytes32(0);
              gameActive   = false;
            // Reset secret pour le prochain round

             (bool success, ) = payable(msg.sender).call{value: _Amount}("");
            require(success, "transfer failed");
            emit GuessResult(msg.sender, true, _Amount);
            emit GameReset();

        } else {
             require(_nextPlayer != address(0), "Invalid next player");
           require(_nextPlayer != msg.sender, "Same player");
           tokenOwner = _nextPlayer;
            emit GuessResult(msg.sender, false, 0);
            emit TokenGiven(_nextPlayer);
        }


    }
    function getOwner() public view returns (address) {
        return owner;
    }
    function getTokenOwner() public view returns (address) {
        require(gameActive, "game not initialized");
        return tokenOwner;
    }
    function getHashedSecret() public view returns (bytes32) {
        require(gameActive, "game not initialized");
        return hashedSecret;
    }

   

}